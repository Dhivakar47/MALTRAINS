import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, X, Bot, User, Loader2, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { Separator } from '@/components/ui/separator';

interface Message {
    role: 'user' | 'assistant';
    content: string;
    data?: any[];
    sql?: string;
}

export const ChatbotPanel = () => {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        { role: 'assistant', content: t('chatbot.welcome') }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const { toast } = useToast();

    useEffect(() => {
        if (isOpen) {
            setMessages([
                { role: 'assistant', content: t('chatbot.welcome') }
            ]);
        }
    }, [isOpen, t]);

    useEffect(() => {
        if (scrollAreaRef.current) {
            const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
            if (scrollContainer) {
                scrollContainer.scrollTop = scrollContainer.scrollHeight;
            }
        }
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage = input.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
        setIsLoading(true);

        try {
            let sql = '';
            const lowerQuestion = userMessage.toLowerCase();

            // English and Tamil keyword support
            const hiKeywords = ['hi', 'hello', 'hey', 'வணக்கம்', 'நலமா'];
            const riskKeywords = ['risk', 'highest', 'ஆபத்து', 'அபாயம்'];
            const standbyKeywords = ['standby', 'held', 'rejected', 'காத்திருப்பு'];
            const mileageKeywords = ['mileage', 'total distance', 'distance', 'தூரம்', 'மைலேஜ்'];
            const brandingKeywords = ['branding', 'campaign', 'பிராண்டிங்', 'பிரச்சாரம்'];
            const runningKeywords = ['running', 'active', 'where is', 'இயங்குகிறது', 'ஓடுகிறது', 'எங்கே'];
            const operatorKeywords = ['operator', 'who is driving', 'driver', 'ஓட்டுநர்', 'டிரைவர்'];
            const searchKeywords = ['search', 'find', 'get', 'status', 'state', 'look up', 'தேடு', 'கண்டுபிடி', 'நிலை'];
            const maintainKeywords = ['maintenance', 'repair', 'fix', 'பராமரிப்பு', 'பழுது'];
            const incidentKeywords = ['incident', 'accident', 'problem', 'alerts', 'விபத்து', 'பிரச்சனை'];
            const countKeywords = ['how many trains', 'total trains', 'எத்தனை ரயில்கள்'];
            const staffKeywords = ['staff', 'employees', 'attendance', 'பணியாளர்கள்'];

            if (hiKeywords.some(k => lowerQuestion.includes(k))) {
                setMessages(prev => [...prev, { 
                    role: 'assistant', 
                    content: t('chatbot.hi_response') 
                }]);
                setIsLoading(false);
                return;
            }

            if (riskKeywords.some(k => lowerQuestion.includes(k))) {
                sql = 'SELECT t.rake_id, r.risk_score, r.risk_level, r.failure_probability FROM public.trainsets t JOIN public.risk_predictions r ON t.id = r.trainset_id ORDER BY r.risk_score DESC';
            } else if (standbyKeywords.some(k => lowerQuestion.includes(k))) {
                sql = "SELECT t.rake_id, d.decision, d.explanation_text FROM public.trainsets t JOIN public.induction_decisions d ON t.id = d.trainset_id WHERE d.decision IN ('standby', 'held')";
            } else if (mileageKeywords.some(k => lowerQuestion.includes(k))) {
                sql = "SELECT rake_id, total_mileage_km, current_status FROM public.trainsets ORDER BY total_mileage_km DESC";
            } else if (brandingKeywords.some(k => lowerQuestion.includes(k))) {
                sql = "SELECT t.rake_id, b.campaign_name, b.accumulated_hours, b.target_hours FROM public.trainsets t JOIN public.branding_status b ON t.id = b.trainset_id WHERE b.is_active = true";
            } else if (runningKeywords.some(k => lowerQuestion.includes(k))) {
                sql = "SELECT rake_id, current_status, route FROM public.trainsets WHERE current_status = 'service_ready'";
            } else if (maintainKeywords.some(k => lowerQuestion.includes(k))) {
                sql = "SELECT t.rake_id, j.title, j.status, j.criticality FROM public.job_cards j JOIN public.trainsets t ON j.trainset_id = t.id WHERE j.status != 'closed' LIMIT 5";
            } else if (incidentKeywords.some(k => lowerQuestion.includes(k))) {
                sql = "SELECT title, severity, created_at FROM public.alerts WHERE is_resolved = false OR is_resolved IS NULL ORDER BY created_at DESC LIMIT 5";
            } else if (countKeywords.some(k => lowerQuestion.includes(k))) {
                sql = "SELECT count(*) as total_trains FROM public.trainsets";
            } else if (staffKeywords.some(k => lowerQuestion.includes(k))) {
                sql = "SELECT staff_name, status FROM public.staff_attendance WHERE check_out_time IS NULL LIMIT 5";
            } else if (operatorKeywords.some(k => lowerQuestion.includes(k))) {
                const rakeIdIden = lowerQuestion.match(/rake-\d+|rs-\d+/)?.[0] || '';
                if (rakeIdIden) {
                    sql = `SELECT t.rake_id, p.full_name, p.designation, r.status FROM public.train_runs r JOIN public.trainsets t ON r.trainset_id = t.id JOIN public.user_profiles p ON r.user_id = p.user_id WHERE r.status = 'active' AND t.rake_id ILIKE '%${rakeIdIden}%'`;
                } else {
                    sql = "SELECT t.rake_id, p.full_name, p.designation, r.status FROM public.train_runs r JOIN public.trainsets t ON r.trainset_id = t.id JOIN public.user_profiles p ON r.user_id = p.user_id WHERE r.status = 'active'";
                }
            } else if (searchKeywords.some(k => lowerQuestion.includes(k))) {
                const rakeIdIden = lowerQuestion.match(/(?:rake-|rs-)?\d+/)?.[0] || '';
                if (rakeIdIden) {
                    sql = `SELECT rake_id, current_status, route, total_mileage_km FROM public.trainsets WHERE rake_id ILIKE '%${rakeIdIden}%'`;
                } else {
                    sql = "SELECT rake_id, current_status, route FROM public.trainsets";
                }
            } else {
                const numMatch = lowerQuestion.match(/\d+/);
                if (numMatch) {
                    sql = `SELECT rake_id, current_status, route, total_mileage_km FROM public.trainsets WHERE rake_id ILIKE '%${numMatch[0]}%'`;
                } else {
                    sql = "SELECT rake_id, current_status, route FROM public.trainsets";
                }
            }

            const { data: queryResult, error: rpcError } = await (supabase.rpc as any)('execute_ai_query', {
                sql_query: sql
            });

            if (rpcError) throw rpcError;

            let dynamicAnswer = "";
            const results = queryResult as any[];

            if (results && results.length > 0) {
               if (riskKeywords.some(k => lowerQuestion.includes(k))) {
                   dynamicAnswer = t('chatbot.riskResponse', { count: results.length, rakeId: results[0].rake_id, score: results[0].risk_score });
               } else if (standbyKeywords.some(k => lowerQuestion.includes(k))) {
                   dynamicAnswer = t('chatbot.standbyResponse', { count: results.length, rakeId: results[0].rake_id, decision: results[0].decision, explanation: results[0].explanation_text || 'Operational requirements' });
               } else if (mileageKeywords.some(k => lowerQuestion.includes(k))) {
                   dynamicAnswer = t('chatbot.mileageResponse', { rakeId: results[0].rake_id, mileage: results[0].total_mileage_km });
               } else if (brandingKeywords.some(k => lowerQuestion.includes(k))) {
                   dynamicAnswer = t('chatbot.brandingResponse', { count: results.length, rakeId: results[0].rake_id, campaign: results[0].campaign_name });
               } else if (runningKeywords.some(k => lowerQuestion.includes(k))) {
                   dynamicAnswer = t('chatbot.runningResponse', { count: results.length, rakeId: results[0].rake_id, route: results[0].route || 'Main' });
                } else if (operatorKeywords.some(k => lowerQuestion.includes(k))) {
                   if (lowerQuestion.match(/rake-\d+|rs-\d+/)) {
                       const rakeIdMatch = lowerQuestion.match(/rake-\d+|rs-\d+/)?.[0].toUpperCase();
                       dynamicAnswer = t('chatbot.operatorResponse', { rakeId: rakeIdMatch, name: results[0].full_name, designation: results[0].designation });
                   } else {
                       dynamicAnswer = t('chatbot.operatorGeneral', { name: results[0].full_name, rakeId: results[0].rake_id });
                   }
               } else if (searchKeywords.some(k => lowerQuestion.includes(k)) || lowerQuestion.match(/\d+/)) {
                   const statusText = results[0].current_status ? results[0].current_status.replace('_', ' ') : 'unknown';
                   const routeText = results[0].route || 'assigned route';
                   dynamicAnswer = `The status of Rake ${results[0].rake_id} is: ${statusText}. It is currently on ${routeText}.`;
               } else if (maintainKeywords.some(k => lowerQuestion.includes(k))) {
                   dynamicAnswer = `Found ${results.length} active maintenance jobs. For example, Rake ${results[0].rake_id} has a ${results[0].criticality} priority task: ${results[0].title}.`;
               } else if (incidentKeywords.some(k => lowerQuestion.includes(k))) {
                   dynamicAnswer = `There are ${results.length} active alerts/incidents. Latest: ${results[0].title} (${results[0].severity} severity).`;
               } else if (countKeywords.some(k => lowerQuestion.includes(k))) {
                   dynamicAnswer = `We currently have ${results[0].total_trains} trains registered in the system.`;
               } else if (staffKeywords.some(k => lowerQuestion.includes(k))) {
                   dynamicAnswer = `Found ${results.length} staff members currently signed in, including ${results[0].staff_name}.`;
               } else {
                   dynamicAnswer = t('chatbot.generalSuccess', { count: results.length });
               }
            } else {
                dynamicAnswer = t('chatbot.noResults');
            }

            setMessages(prev => [...prev, {
                role: 'assistant',
                content: dynamicAnswer,
                data: queryResult as any[],
                sql: sql
            }]);

        } catch (error: any) {
            console.error('Chatbot error:', error);
            const errorMessage = error.message || 'Unknown error';
            toast({
                title: t('chatbot.errorTitle'),
                description: `${t('chatbot.errorDesc')}: ${errorMessage}`,
                variant: 'destructive',
            });
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: `${t('chatbot.errorBrain')} (Error: ${errorMessage}).`
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed bottom-6 right-6 z-50">
            {!isOpen ? (
                <Button
                    onClick={() => setIsOpen(true)}
                    className="rounded-full h-14 w-14 shadow-lg hover:shadow-xl transition-all duration-300"
                >
                    <MessageSquare className="h-6 w-6" />
                </Button>
            ) : (
                <Card className="w-[calc(100vw-3rem)] sm:w-[400px] h-[75vh] sm:h-[600px] flex flex-col shadow-2xl border-primary/20 bg-background/95 backdrop-blur-sm animate-in slide-in-from-bottom-5">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 border-b">
                        <div className="flex items-center space-x-2">
                            <div className="bg-primary/10 p-2 rounded-full">
                                <Bot className="h-5 w-5 text-primary" />
                            </div>
                            <CardTitle className="text-lg font-bold">{t('chatbot.title')}</CardTitle>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
                            <X className="h-5 w-5" />
                        </Button>
                    </CardHeader>

                    <CardContent className="flex-1 p-0 overflow-hidden">
                        <ScrollArea className="h-full p-4" ref={scrollAreaRef}>
                            <div className="space-y-4">
                                {messages.map((m, i) => (
                                    <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`flex space-x-2 max-w-[85%] ${m.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                                            <div className={`mt-1 h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${m.role === 'assistant' ? 'bg-primary/10' : 'bg-muted'}`}>
                                                {m.role === 'assistant' ? <Bot className="h-4 w-4 text-primary" /> : <User className="h-4 w-4" />}
                                            </div>
                                            <div className="space-y-2">
                                                <div className={`p-3 rounded-2xl text-sm ${m.role === 'user' ? 'bg-primary text-primary-foreground rounded-tr-none' : 'bg-muted rounded-tl-none'}`}>
                                                    {m.content}
                                                </div>

                                                {m.data && m.data.length > 0 && (
                                                    <div className="bg-muted/50 rounded-lg p-2 text-xs overflow-x-auto border">
                                                        <div className="flex items-center space-x-1 mb-1 font-semibold text-primary/70">
                                                            <Database className="h-3 w-3" />
                                                            <span>{t('chatbot.retrievedData')}</span>
                                                        </div>
                                                        <table className="w-full text-left">
                                                            <thead>
                                                                <tr className="border-b border-muted">
                                                                    {Object.keys(m.data[0]).map(k => (
                                                                        <th key={k} className="p-1 font-medium">{k}</th>
                                                                    ))}
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {m.data.map((row, ri) => (
                                                                    <tr key={ri} className="border-b border-muted/50 last:border-0">
                                                                        {Object.values(row).map((v: any, vi) => (
                                                                            <td key={vi} className="p-1 break-all">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</td>
                                                                        ))}
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )}

                                                {m.sql && (
                                                    <details className="text-[10px] text-muted-foreground cursor-pointer hover:text-primary transition-colors">
                                                        <summary>{t('chatbot.viewSql')}</summary>
                                                        <code className="block p-2 mt-1 bg-muted/30 rounded border font-mono whitespace-pre-wrap">{m.sql}</code>
                                                    </details>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {isLoading && (
                                    <div className="flex justify-start">
                                        <div className="flex space-x-2 max-w-[85%]">
                                            <div className="mt-1 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                                <Bot className="h-4 w-4 text-primary" />
                                            </div>
                                            <div className="bg-muted p-3 rounded-2xl rounded-tl-none text-sm">
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </CardContent>

                    <Separator className="bg-primary/10" />

                    <CardFooter className="p-4 pt-4">
                        <form
                            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                            className="flex w-full items-center space-x-2"
                        >
                            <Input
                                placeholder={t('chatbot.placeholder')}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                disabled={isLoading}
                                className="flex-1 focus-visible:ring-primary"
                            />
                            <Button type="submit" size="icon" disabled={isLoading} className="shrink-0 bg-primary hover:bg-primary/90">
                                <Send className="h-4 w-4" />
                            </Button>
                        </form>
                    </CardFooter>
                </Card>
            )}
        </div>
    );
};
