
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import ProfileForm from "@/components/settings/profile-form";
import ManageStatuses from "@/components/settings/manage-statuses";
import ChangePasswordForm from "@/components/settings/change-password-form";
import { ThemeToggle } from "@/components/theme-toggle";

export default function SettingsPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold font-headline">Settings</h1>
                <p className="text-muted-foreground">Manage your account and preferences.</p>
            </div>
            
            <ProfileForm />
            <ChangePasswordForm />
            <ManageStatuses />

            <Card>
                <CardHeader>
                    <CardTitle>Theme</CardTitle>
                    <CardDescription>Select your preferred color scheme.</CardDescription>
                </CardHeader>
                <CardContent>
                    <ThemeToggle />
                </CardContent>
            </Card>

        </div>
    )
}
