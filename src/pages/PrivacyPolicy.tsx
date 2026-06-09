// Required by Google Play Store and Apple App Store.
// This page must be publicly accessible — no auth required.
// The URL to this page goes in your store listing.

import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="flex items-center gap-3 p-4 max-w-2xl mx-auto">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="font-semibold">Privacy Policy</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-6 space-y-6 text-sm leading-relaxed">

        <div>
          <p className="text-muted-foreground">Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
        </div>

        <section className="space-y-2">
          <h2 className="text-base font-semibold">1. Introduction</h2>
          <p>
            QuickChef ("we", "our", or "us") is committed to protecting your privacy.
            This Privacy Policy explains how we collect, use, and safeguard your
            information when you use the QuickChef mobile application and related services.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold">2. Information We Collect</h2>
          <p><strong>Account information:</strong> When you register, we collect your email address and a securely hashed password. We never store your plain-text password.</p>
          <p><strong>Profile information:</strong> We collect optional information you provide including your display name, dietary preferences, allergies, cooking skill level, preferred cuisines, and health goals. This information is used solely to personalize your recipe suggestions.</p>
          <p><strong>Pantry items:</strong> We store the ingredient names you add to your pantry to help generate relevant recipes.</p>
          <p><strong>Saved recipes:</strong> We store recipes you choose to save, including ingredients, instructions, and nutritional information.</p>
          <p><strong>Usage data:</strong> We track the number of AI recipe generations you perform each day to enforce free tier limits. We do not collect analytics, advertising identifiers, or behavioral tracking data.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold">3. How We Use Your Information</h2>
          <p>We use the information we collect to:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Provide and operate the QuickChef service</li>
            <li>Generate personalized AI recipe suggestions based on your preferences</li>
            <li>Enforce daily usage limits for the free tier</li>
            <li>Authenticate your account and maintain your session</li>
            <li>Improve and maintain the application</li>
          </ul>
          <p>We do not sell, rent, or share your personal information with third parties for marketing purposes.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold">4. AI-Generated Content</h2>
          <p>
            QuickChef uses OpenAI's API to generate recipe suggestions. When you request a recipe,
            your ingredient list and dietary preferences are sent to OpenAI's servers to generate
            a response. This data is processed in accordance with{' '}
            <a href="https://openai.com/privacy" className="underline text-primary" target="_blank" rel="noopener noreferrer">
              OpenAI's Privacy Policy
            </a>.
            We do not send personally identifiable information such as your name or email to OpenAI.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold">5. Data Storage and Security</h2>
          <p>
            Your data is stored in a secure PostgreSQL database hosted by Neon.
            All data transmission between the app and our servers uses HTTPS encryption.
            Passwords are hashed using bcrypt and are never stored in plain text.
            Authentication tokens (JWTs) expire after 7 days.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold">6. Data Retention and Deletion</h2>
          <p>
            We retain your account data for as long as your account is active.
            You may request deletion of your account and all associated data at any time
            by contacting us at the email address below. Upon request, we will permanently
            delete your account, profile, pantry items, and saved recipes within 30 days.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold">7. Children's Privacy</h2>
          <p>
            QuickChef is not directed at children under the age of 13.
            We do not knowingly collect personal information from children under 13.
            If you believe a child has provided us with personal information, please contact us
            and we will promptly delete it.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold">8. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. We will notify you of
            significant changes by updating the "Last updated" date at the top of this page.
            Continued use of the app after changes constitutes acceptance of the updated policy.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold">9. Contact Us</h2>
          <p>
            If you have questions about this Privacy Policy or wish to request data deletion,
            please contact us at:
          </p>
          <p className="font-medium">support@quickchef.app</p>
        </section>

      </div>
    </div>
  );
}
