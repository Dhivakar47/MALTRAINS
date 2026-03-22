import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
        if (!RESEND_API_KEY) {
            throw new Error("RESEND_API_KEY is not configured");
        }

        const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

        // Verify the caller is authenticated (any logged-in user can report)
        const authHeader = req.headers.get("Authorization");
        if (!authHeader?.startsWith("Bearer ")) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 401,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        const anonClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
            global: { headers: { Authorization: authHeader } },
        });

        const token = authHeader.replace("Bearer ", "");
        const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
        if (claimsError || !claimsData?.claims) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 401,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const { incidentType, location, dateTime, description, phoneNumber, reporterName, reporterEmail } = await req.json();

        if (!incidentType || !location || !description) {
            return new Response(JSON.stringify({ error: "Incident type, location, and description are required" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // Find all admin users
        const { data: adminRoles, error: rolesError } = await supabase
            .from("user_roles")
            .select("user_id")
            .eq("role", "admin");

        if (rolesError) throw rolesError;

        if (!adminRoles || adminRoles.length === 0) {
            return new Response(JSON.stringify({ error: "No admin users found to notify" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // Get admin email addresses
        const adminEmails: string[] = [];
        for (const adminRole of adminRoles) {
            const { data: userData, error: userError } = await supabase.auth.admin.getUserById(adminRole.user_id);
            if (!userError && userData?.user?.email) {
                adminEmails.push(userData.user.email);
            }
        }

        if (adminEmails.length === 0) {
            return new Response(JSON.stringify({ error: "No admin email addresses found" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const incidentTypeLabels: Record<string, string> = {
            fire: "🔥 Fire",
            harassment: "🚨 Harassment",
            theft: "🔒 Theft",
            medical_emergency: "🏥 Medical Emergency",
            safety_hazard: "⚠️ Safety Hazard",
            other: "📋 Other",
        };

        const incidentLabel = incidentTypeLabels[incidentType] || incidentType;
        const formattedDate = dateTime
            ? new Date(dateTime).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
            : "Not specified";

        const severityColors: Record<string, string> = {
            fire: "#dc2626",
            harassment: "#9333ea",
            theft: "#ea580c",
            medical_emergency: "#dc2626",
            safety_hazard: "#eab308",
            other: "#3b82f6",
        };
        const color = severityColors[incidentType] || "#3b82f6";

        // Send email to all admins
        const results = [];
        for (const email of adminEmails) {
            const res = await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${RESEND_API_KEY}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    from: "MALTRAINS Incidents <onboarding@resend.dev>",
                    to: [email],
                    subject: `[MALTRAINS INCIDENT] ${incidentLabel} — ${location}`,
                    html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: ${color}; color: white; padding: 15px 20px; border-radius: 8px 8px 0 0;">
                <h2 style="margin: 0;">🚨 Incident Report</h2>
              </div>
              <div style="border: 1px solid #e5e7eb; border-top: none; padding: 20px; border-radius: 0 0 8px 8px;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #374151; width: 140px;">Incident Type:</td>
                    <td style="padding: 8px 0; color: #4b5563;">${incidentLabel}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #374151;">Location:</td>
                    <td style="padding: 8px 0; color: #4b5563;">${location}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #374151;">Date & Time:</td>
                    <td style="padding: 8px 0; color: #4b5563;">${formattedDate}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #374151;">Reported By:</td>
                    <td style="padding: 8px 0; color: #4b5563;">${reporterName} (${reporterEmail})</td>
                  </tr>
                </table>
                <div style="margin-top: 15px; padding: 15px; background: #f9fafb; border-radius: 6px; border-left: 4px solid ${color};">
                  <p style="margin: 0 0 5px; font-weight: bold; color: #374151;">Description:</p>
                  <p style="margin: 0; color: #4b5563; line-height: 1.6;">${description}</p>
                </div>
                <hr style="margin-top: 20px; border: none; border-top: 1px solid #e5e7eb;" />
                <p style="font-size: 12px; color: #9ca3af; margin-bottom: 0;">
                  This is an automated incident report from MALTRAINS Metro Operations Dashboard. Please take appropriate action immediately.
                </p>
              </div>
            </div>
          `,
                }),
            });

            const resData = await res.json();
            results.push({ email, success: res.ok, data: resData });
        }

        const successCount = results.filter((r) => r.success).length;

        // --- SMS Sending Logic ---
        let smsSent = false;
        let smsErrorData = null;

        if (phoneNumber) {
            const TWILIO_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
            const TWILIO_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
            const TWILIO_PHONE = Deno.env.get("TWILIO_PHONE_NUMBER");

            if (TWILIO_SID && TWILIO_TOKEN && TWILIO_PHONE) {
                const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`;
                const smsBody = `🚨 MALTRAINS Incident Alert!\nType: ${incidentLabel}\nLocation: ${location}\nTime: ${formattedDate}\nDesc: ${description.substring(0, 100)}...`;

                const formData = new URLSearchParams();
                formData.append("To", phoneNumber);
                formData.append("From", TWILIO_PHONE);
                formData.append("Body", smsBody);

                const twilioAuth = btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`);

                try {
                    const smsRes = await fetch(twilioUrl, {
                        method: "POST",
                        headers: {
                            "Authorization": `Basic ${twilioAuth}`,
                            "Content-Type": "application/x-www-form-urlencoded"
                        },
                        body: formData.toString()
                    });

                    if (smsRes.ok) {
                        smsSent = true;
                        console.log(`✅ SMS sent to ${phoneNumber}`);
                    } else {
                        smsErrorData = await smsRes.text();
                        console.error("Failed to send SMS:", smsErrorData);
                    }
                } catch (e) {
                    console.error("Error sending SMS via Twilio:", e);
                    smsErrorData = e instanceof Error ? e.message : "Unknown Twilio error";
                }
            } else {
                // Mock SMS sending if credentials not found
                console.log(`[MOCK SMS] To: ${phoneNumber} | MSG: Incident reported: ${incidentLabel} at ${location}`);
                smsSent = true;
            }
        }

        return new Response(
            JSON.stringify({
                success: true,
                sent: successCount,
                total: adminEmails.length,
                results,
                smsSent,
                smsError: smsErrorData
            }),
            {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
        );
    } catch (error: unknown) {
        console.error("Error sending incident report email:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return new Response(JSON.stringify({ error: errorMessage }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
