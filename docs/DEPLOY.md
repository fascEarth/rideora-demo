# Deploying Rideora for a new customer

About 45 minutes per customer once you've done it once. Each customer gets their own server, database and domain.

## 1. Accounts to create (in the customer's name where possible)

| What | Where | Notes |
|---|---|---|
| Server (VPS) | Hostinger KVM 2 (India), DigitalOcean, Hetzner or AWS Lightsail | Ubuntu 24.04, 2 vCPU, 4–8 GB RAM. Pick the region nearest the customer's city. |
| Domain | GoDaddy, Hostinger, Namecheap or Cloudflare | The customer should own it. A subdomain of their existing site also works, e.g. `book.citycabs.com`. |
| Card payments | Razorpay (India) or Stripe (UAE, UK, EU, US...) | Business KYC in the customer's name; money settles to their bank. |
| Email | Zoho Mail, Google Workspace, Brevo or Resend | An address like `bookings@theirdomain.com` with SMTP access. |
| Google Maps (optional) | console.cloud.google.com → enable **Routes API** | Exact road distances for any address. Set a monthly budget cap. |

## 2. Point the domain at the server

In the domain's DNS: an **A record** for the domain (or subdomain) → the server's IP address. Add `www` as a CNAME to the main name if you use a root domain. Wait until `ping your-domain` shows the server IP.

## 3. Install

SSH into the server as root (or a sudo user):

```bash
apt-get update && apt-get install -y git
git clone https://github.com/fascEarth/rideora-demo.git /opt/rideora   # use a GitHub deploy key or token: the repo is private
cd /opt/rideora
sudo bash scripts/install.sh
```

The script installs Docker, asks for the domain, certificate email, owner's admin email and region preset, generates secrets, starts everything with HTTPS, opens only ports 22/80/443 and schedules nightly backups. It prints the first admin password: give it to the owner and ask them to change it.

## 4. Optional services

Edit `/opt/rideora/.env`, then run `docker compose up -d` to apply.

**Razorpay**: Dashboard → Account & Settings → API Keys → generate live keys.
```
PAYMENT_PROVIDER=razorpay
RAZORPAY_KEY_ID=rzp_live_...
RAZORPAY_KEY_SECRET=...
```

**Stripe**: Developers → API keys → secret key.
```
PAYMENT_PROVIDER=stripe
STRIPE_SECRET_KEY=sk_live_...
```
Test first with test keys (`rzp_test_...`, `sk_test_...`) and a test card.

**Email (SMTP)**, for example Zoho Mail (India data centre):
```
SMTP_HOST=smtppro.zoho.in
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=bookings@theirdomain.com
SMTP_PASS=app-specific-password
MAIL_FROM="City Cabs <bookings@theirdomain.com>"
```
Then CMS → Settings → *Send me a test*.

**Google distances**: `GOOGLE_MAPS_API_KEY=...` (restrict the key to the Routes API and to the server's IP).

## 5. Hand over

Sign in at `https://domain/admin` and, with the owner:
1. **Branding**: name, colour, phone, WhatsApp, email, address, currency, time zone, and "Send new booking alerts to".
2. **Fleet & pricing**: their rates, tax, airport fee, night hours, cancellation cut-off, payment options.
3. **Places**: their airports, stations, hotels and areas with coordinates.
4. **Vehicles** and **Drivers**, then **Staff logins** for dispatchers and each driver.
5. **Website content**: headline, services, FAQ, terms.
6. Make a test booking end to end, including a card payment and a refund.

## Updates, backups, troubleshooting

| Task | Command (in /opt/rideora) |
|---|---|
| Update to the latest version | `bash scripts/update.sh` (backs up first; migrations run automatically) |
| Backup now | `bash scripts/backup.sh` (also runs nightly; keeps 14 days in `backups/`) |
| Restore | `bash scripts/restore.sh backups/rideora-YYYY-MM-DD-HHMM.sql.gz` |
| Logs | `docker compose logs -f app` |
| Restart | `docker compose restart app` |
| Status | `docker compose ps` |

Copy `backups/` off the server weekly (e.g. to Google Drive or S3); a backup on the same server doesn't protect against losing the server. Most VPS providers also sell automatic snapshots for a small monthly fee.

**HTTPS not working**: DNS isn't pointing at the server yet, or ports 80/443 are blocked by the provider's firewall. Check `docker compose logs caddy`.
**Forgot a password**: `bash scripts/reset-password.sh owner@example.com 'NewPassword123'`
