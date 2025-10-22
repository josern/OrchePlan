
import ProfileForm from "@/components/settings/profile-form";
import ChangePasswordForm from "@/components/settings/change-password-form";
import AppearanceForm from "@/components/settings/appearance-form";
import { ComponentErrorBoundary } from "@/components/error-boundary";

export default function SettingsPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold font-headline">Settings</h1>
                <p className="text-muted-foreground">Manage your account and preferences.</p>
            </div>
            
            <ComponentErrorBoundary>
                <ProfileForm />
            </ComponentErrorBoundary>
            <ComponentErrorBoundary>
                <ChangePasswordForm />
            </ComponentErrorBoundary>
            <ComponentErrorBoundary>
                <AppearanceForm />
            </ComponentErrorBoundary>

        </div>
    )
}
