import { useState, useEffect, useRef } from 'react';
import { supabaseApi } from '@/lib/supabaseApi';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Zap, Lock, Pencil, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { computeStats, incrementMessageCount, canSendMessage } from '@/lib/messageLimit';
import { useAppSettings } from '@/lib/AppSettingsContext';
import { getKaelSystemPrompt } from '@/lib/trainingTypes';
import MessageBubble from '@/components/kael/MessageBubble';

const CONTEXT_MESSAGE_COUNT = 30;

export default function Kael() {
  const { settings } = useAppSettings();
  const [user, setUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    supabaseApi.auth.me().then(u => {
      setUser(u);
      setStats(computeStats(u, u?.subscription_plan || 'free'));
    });
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    supabaseApi.entities.KaelMessage.filter({}, 'created_date', 200).then(msgs => {
      setMessages(msgs);
    });
  }, [user?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, loading]);

  const plan = user?.subscription_plan || 'free';
  const atLimit = stats ? stats.remaining === 0 : false;
  const firstName = user?.first_name || user?.full_name?.split(' ')[0] || '';

  const buildPrompt = (history) => {
    const isElite = plan === 'elite';
    const trainingType = user?.training_type || 'calisthenics';
    const lang = settings.language || 'English';
    const langInstruction = lang !== 'English' ? `\n\nCRITICAL: Respond ENTIRELY in ${lang}. Every word of your response must be in ${lang}.` : '';

    const recentHistory = history.slice(-CONTEXT_MESSAGE_COUNT)
      .map(m => `${m.role === 'user' ? 'User' : 'Kael'}: ${m.content}`)
      .join('\n\n');

    return `${getKaelSystemPrompt(trainingType, firstName, isElite)}${langInstruction}\n\nCONVERSATION HISTORY (remember what the user has told you about their capabilities, limitations, and preferences — update your understanding if they say something new or different):\n${recentHistory}\n\nKael:`;
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const isEditing = !!editingMessage;
    if (!isEditing && !canSendMessage(stats)) return;

    setInput('');
    setLoading(true);

    let currentMessages = [...messages];

    if (isEditing) {
      const editIndex = messages.findIndex(m => m.id === editingMessage.id);
      const toDelete = messages.slice(editIndex);
      await Promise.all(toDelete.map(m => supabaseApi.entities.KaelMessage.delete(m.id)));
      currentMessages = messages.slice(0, editIndex);
      setMessages(currentMessages);
      setEditingMessage(null);
    }

    // Create user message in DB
    const userMsg = await supabaseApi.entities.KaelMessage.create({
      role: 'user',
      content: text,
      is_edit: isEditing,
    });
    currentMessages = [...currentMessages, userMsg];
    setMessages(currentMessages);

    // Build prompt with conversation context
    const prompt = buildPrompt(currentMessages);
    // All AI requests go through Supabase -> OpenRouter Auto Router.
    // The frontend never chooses or exposes a specific AI model.
    const response = await supabaseApi.ai.invoke({
      type: 'kael',
      prompt,
    });

    // Create assistant message in DB
    const assistantMsg = await supabaseApi.entities.KaelMessage.create({
      role: 'assistant',
      content: response,
    });
    setMessages(prev => [...prev, assistantMsg]);

    // Increment count only for new messages, not edits
    if (!isEditing) {
      const newStats = await incrementMessageCount(plan);
      setStats(newStats);
    }

    setLoading(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const cancelEdit = () => {
    setEditingMessage(null);
    setInput('');
  };

  const handleEdit = (msg) => {
    setEditingMessage(msg);
    setInput(msg.content);
  };

  const greeting = { role: 'assistant', content: `Hey${firstName ? `, ${firstName}` : ''}! I'm **Kael**, your coach. What do you need? 💪` };

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)]">
      {/* Header */}
      <div className="px-5 pb-3 border-b border-border bg-card/50 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary/15 flex items-center justify-center border border-primary/20">
            <Zap className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="font-heading font-bold text-lg leading-tight">Kael</h1>
            <p className="text-xs text-muted-foreground">AI Fitness Coach · Always available</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            {stats && (
              <span className={cn(
                "text-[10px] font-semibold px-2 py-0.5 rounded-full border",
                atLimit ? "border-destructive/40 text-destructive bg-destructive/10" : "border-border text-muted-foreground bg-muted/50"
              )}>
                {stats.remaining} msg left
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && !loading && (
          <MessageBubble msg={greeting} isUser={false} canEdit={false} />
        )}
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            msg={msg}
            isUser={msg.role === 'user'}
            onEdit={handleEdit}
            canEdit={!loading && !editingMessage}
          />
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="w-7 h-7 rounded-xl bg-primary/15 flex items-center justify-center mr-2 flex-shrink-0 mt-0.5">
              <Zap className="w-3.5 h-3.5 text-primary" />
            </div>
            <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1.5 items-center h-5">
                <div className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:0ms]" />
                <div className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:150ms]" />
                <div className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Limit notice */}
      {atLimit && !editingMessage && (
        <div className="mx-4 mb-2 p-4 rounded-2xl bg-destructive/10 border border-destructive/30 flex items-start gap-3">
          <Lock className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-destructive">Monthly limit reached</p>
            <p className="text-xs text-muted-foreground mt-0.5">You've used all {stats?.limit} messages this month. Upgrade your plan to keep chatting with Kael. Resets at the start of next month.</p>
          </div>
        </div>
      )}

      {/* Monthly reset note */}
      {stats && !atLimit && (
        <p className="text-[10px] text-muted-foreground text-center pb-1 px-4">
          {stats.remaining} of {stats.limit} messages left · resets monthly
        </p>
      )}

      {/* Editing indicator */}
      {editingMessage && (
        <div className="mx-4 mb-1 flex items-center gap-2 text-xs text-primary bg-primary/10 border border-primary/20 rounded-lg px-3 py-1.5">
          <Pencil className="w-3 h-3 shrink-0" />
          <span>Editing message — resubmit won't count against your limit</span>
          <button onClick={cancelEdit} className="ml-auto p-0.5 hover:text-foreground" aria-label="Cancel edit">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Input */}
      <div className="px-4 pt-2 border-t border-border bg-card/50 backdrop-blur-sm flex-shrink-0 pb-[calc(6rem_+_env(safe-area-inset-bottom))] sm:pb-4">
        <div className="flex gap-2 items-end">
          <Textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={atLimit && !editingMessage ? "Upgrade to keep chatting…" : "Ask Kael anything…"}
            disabled={(atLimit && !editingMessage) || loading}
            className="flex-1 min-h-[44px] max-h-32 resize-none rounded-2xl border-border bg-muted/50 text-sm py-3 px-4"
            rows={1}
          />
          <Button
            size="icon"
            className="h-11 w-11 rounded-2xl flex-shrink-0"
            disabled={!input.trim() || loading || (atLimit && !editingMessage)}
            onClick={sendMessage}
          >
            {editingMessage ? <Pencil className="w-4 h-4" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}