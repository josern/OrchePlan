#!/bin/bash

# Script to update admin.ts validation calls

cd /home/coder/OrchePlan/backend

# Create a backup
cp src/routes/admin.ts src/routes/admin.ts.backup-pre-secure

# Update validation calls
sed -i 's/validationResult(req)/[]/g' src/routes/admin.ts
sed -i 's/param(\x27email\x27)\.isEmail()\.withMessage(\x27Valid email required\x27),/createSecureValidation([{ field: "email", source: "params", type: "email" }]),/g' src/routes/admin.ts
sed -i 's/param(\x27id\x27)\.isUUID()\.withMessage(\x27Valid user ID required\x27),/createSecureValidation([{ field: "id", source: "params", type: "uuid" }]),/g' src/routes/admin.ts
sed -i 's/body(\x27reason\x27)\.isLength({ min: 1, max: 500 })\.withMessage(\x27Reason is required (1-500 characters)\x27),/createSecureValidation([{ field: "reason", source: "body", type: "string", minLength: 1, maxLength: 500 }]),/g' src/routes/admin.ts
sed -i 's/body(\x27duration\x27)\.optional()\.isInt({ min: 1 })\.withMessage(\x27Duration must be a positive number (minutes)\x27),/createSecureValidation([{ field: "duration", source: "body", type: "number", optional: true }]),/g' src/routes/admin.ts
sed -i 's/body(\x27role\x27)\.isIn(\[\x27user\x27, \x27admin\x27, \x27superuser\x27\])\.withMessage(\x27Role must be user, admin, or superuser\x27),/createSecureValidation([{ field: "role", source: "body", type: "role" }]),/g' src/routes/admin.ts
sed -i 's/body(\x27confirmEmail\x27)\.isEmail()\.withMessage(\x27Confirmation email is required\x27),/createSecureValidation([{ field: "confirmEmail", source: "body", type: "email" }]),/g' src/routes/admin.ts
sed -i 's/body(\x27ip\x27)\.isIP()\.withMessage(\x27Valid IP address required\x27),/createSecureValidation([{ field: "ip", source: "body", type: "string" }]),/g' src/routes/admin.ts

echo "Admin routes validation updated successfully"