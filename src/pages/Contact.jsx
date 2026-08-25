import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Mail, Send } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { supabaseApi } from '@/lib/supabaseApi';

export default function Contact() {
  const { toast } = useToast();

  const [form, setForm] = useState({
    name: '',
    email: '',
    message: '',
  });

  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      await supabaseApi.email.send({
        to: 'washekfitness@gmail.com',
        subject: `New message from ${form.name}`,
        body: `Name: ${form.name}\nEmail: ${form.email}\n\nMessage:\n${form.message}`,
      });

      setForm({
        name: '',
        email: '',
        message: '',
      });

      toast({
        title: 'Message sent',
        description:
          'Thanks for reaching out — Adrian will get back to you soon.',
      });
    } catch (err) {
      toast({
        title: 'Something went wrong',
        description:
          'Please try emailing washekfitness@gmail.com directly.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="px-5 pb-4 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6 pt-2">
        <Link
          to="/"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>

        <div className="flex items-center gap-2">
          <img
            src="/washek-fitness-logo.jpg"
            alt="Washek Fitness"
            className="w-8 h-8 rounded-xl object-contain"
          />

          <span className="font-heading font-bold text-sm">
            Washek Fitness
          </span>
        </div>
      </div>

      <h1 className="font-heading text-3xl font-bold tracking-tight mb-3">
        Contact Us
      </h1>

      <p className="text-muted-foreground mb-8">
        Questions, feedback, or partnership ideas? We'd love to hear from you.
      </p>

      <div className="space-y-6">
        <a
          href="mailto:washekfitness@gmail.com"
          className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 hover:border-primary/40 transition-colors"
        >
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
            <Mail className="w-5 h-5 text-primary" />
          </div>

          <div>
            <p className="font-semibold text-sm">
              Email
            </p>

            <p className="text-xs text-muted-foreground">
              washekfitness@gmail.com
            </p>
          </div>
        </a>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-xl border border-border bg-card p-5"
        >
          <h2 className="font-heading font-semibold text-lg">
            Send a Message
          </h2>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Name
              </label>

              <Input
                required
                value={form.name}
                onChange={(e) =>
                  setForm({
                    ...form,
                    name: e.target.value,
                  })
                }
                placeholder="Your name"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Email
              </label>

              <Input
                required
                type="email"
                value={form.email}
                onChange={(e) =>
                  setForm({
                    ...form,
                    email: e.target.value,
                  })
                }
                placeholder="you@example.com"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Message
            </label>

            <Textarea
              required
              value={form.message}
              onChange={(e) =>
                setForm({
                  ...form,
                  message: e.target.value,
                })
              }
              placeholder="How can we help?"
              className="min-h-[120px] resize-none"
            />
          </div>

          <Button
            type="submit"
            disabled={submitting}
            className="w-full h-11"
          >
            {submitting ? (
              <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                Send Message
                <Send className="ml-2 w-4 h-4" />
              </>
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
