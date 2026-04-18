# Construction ERP - Role and Permission Guide

## Document Control
- Document ID: `ERP-ROLE-GUIDE-001`
- Version: `1.0`
- Date: `2026-04-18`
- Audience: Admins, implementation team, support leads

## 1. Purpose
This guide explains how access behaves in production so teams can safely assign users without exposing sensitive modules.

## 2. Access Model Basics
- Access is controlled by role and workspace eligibility.
- Backend route middleware is the source of truth for permission enforcement.
- Frontend hides routes that user cannot access, but backend checks remain mandatory.

## 3. Practical Role Families
- `super_admin`: full governance and operations access
- `manager`: broad operational + finance control access
- `hr`: employee/admin-oriented and selected read/write operational access
- `crusher_supervisor`: plant-dispatch focused access
- `site_engineer`: project/reporting focused access

## 4. Sensitive Areas (Controlled)
- Accounts posting and workflow actions
- Finance policy and period controls
- Tenant onboarding and owner control surfaces
- Audit logs (read visibility should remain restricted)

## 5. Role Assignment Guardrails
- Grant minimum required role only.
- Keep maker/checker duties separated in finance operations.
- Review inactive users and offboard promptly.
- Avoid shared accounts.

## 6. Common Access Symptoms
- User cannot open page: role/workspace mismatch.
- User sees page but action fails: backend role check blocks mutation.
- Cross-company mismatch error: session scope/header scope conflict.

## 7. Admin Review Checklist
- Weekly role review for finance users
- Confirm no unnecessary `super_admin` accounts
- Confirm onboarding/owner pages are hidden from client-only users
- Confirm audit and policy pages are limited to trusted roles
