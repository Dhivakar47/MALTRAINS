-- ==========================================
-- SAMPLE ALERTS DATASET
-- ==========================================

INSERT INTO public.alerts (alert_type, severity, title, message, created_at)
VALUES 
    (
        'Maintenance', 
        'warning', 
        'Low Brake Fluid Detected', 
        'Trainset TS-104 reports low brake fluid levels in the rear cabin. Scheduled for immediate inspection at Depot A.',
        now() - interval '2 hours'
    ),
    (
        'Operations', 
        'error', 
        'Signal Failure - Sector 5', 
        'Intermittent signal failure detected between Sector 5 and Sector 6. Trains are advised to maintain a 20km/h speed limit in this zone.',
        now() - interval '45 minutes'
    ),
    (
        'System', 
        'info', 
        'Weekly Maintenance Schedule', 
        'The maintenance schedule for the week starting Feb 24th has been published. Please review your assigned trainsets in the dashboard.',
        now() - interval '5 hours'
    ),
    (
        'Safety', 
        'success', 
        'Track Inspection Completed', 
        'Routine track inspection for the Blue Line was completed successfully. No major defects found.',
        now() - interval '1 hour'
    ),
    (
        'Operations', 
        'info', 
        'Staff Training Session', 
        'A mandatory familiarization session for the new AI Dispatcher will be held at 2:00 PM in the Main Briefing Room.',
        now() - interval '10 minutes'
    );
