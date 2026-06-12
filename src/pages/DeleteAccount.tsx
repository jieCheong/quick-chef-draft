import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Trash2 } from 'lucide-react';

export default function DeleteAccount() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="flex items-center gap-3 p-4 max-w-2xl mx-auto">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="font-semibold">Delete Account</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-6 space-y-6 text-sm leading-relaxed">

        <div className="flex items-center gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
          <Trash2 className="h-5 w-5 text-destructive shrink-0" />
          <p className="text-destructive font-medium">
            Deleting your account is permanent and cannot be undone.
          </p>
        </div>

        <section className="space-y-2">
          <h2 className="text-base font-semibold">What gets deleted</h2>
          <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
            <li>Your account and login credentials</li>
            <li>Your profile and dietary preferences</li>
            <li>All pantry items</li>
            <li>All saved recipes</li>
            <li>Your usage history</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold">How to request deletion</h2>
          <p>
            To request deletion of your account and all associated data, send an email to:
          </p>
          <p className="font-medium">support@quickchef.app</p>
          <p className="text-muted-foreground">
            Please send from the email address associated with your QuickChef account.
            We will permanently delete your data within 30 days of receiving your request.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold">What to include in your email</h2>
          <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
            <li>Subject: "Account Deletion Request"</li>
            <li>Your registered email address</li>
            <li>Confirmation that you understand this action is permanent</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold">Confirmation</h2>
          <p className="text-muted-foreground">
            You will receive an email confirmation once your account has been deleted.
            If you have any questions, contact us at{' '}
            <span className="font-medium text-foreground">support@quickchef.app</span>.
          </p>
        </section>

      </div>
    </div>
  );
}
