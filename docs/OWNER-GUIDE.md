# Rideora owner guide

Your booking website is at your domain. Your team signs in at **/admin**. Drivers sign in at **/driver** on their phones.

## A booking's life

1. A customer books on the website. You get an email alert and the booking appears as **Pending** (or **Confirmed** if they paid by card).
2. **Confirm** it from the Dispatch board. The customer gets a confirmation email.
3. **Assign driver** (and vehicle). The status becomes **Assigned**; the customer receives the driver's name, phone and plate, and the driver gets the trip by email and in their driver app.
4. The driver taps **Start trip** (On trip) and **Complete trip** (Completed). Cash trips are marked paid when completed.

You can also open any booking to change status, driver or vehicle, add notes, mark a cash trip as paid, or refund a card payment.

**Phone bookings**: Bookings → *New booking* quotes the fare with your rules and saves the booking.

**Cancellations**: customers can cancel online until the cut-off you set (Fleet & pricing). A cancelled card booking shows *Refund due*; open it and press **Refund** to return the money through Razorpay/Stripe.

## Pricing

Fleet & pricing → each vehicle category has a **base fare**, **per km**, **per hour** and a **minimum fare**. The fare is base + per km × distance, never below the minimum. Then, as set in Fare rules:
- airport fee when pickup or drop-off is a saved place marked *Airport*
- night surcharge % between the night hours
- round trips: two legs minus the round-trip discount %
- hourly hire: hours × hourly rate (minimum hours apply)
- extras (child seat, meet & greet…), promo codes, then tax %

Use **Fare check** at the bottom of the page to test prices before customers see them.

## Distances

With a Google Maps key, any address gets an exact road distance. Without one, distances between **saved places** come from their coordinates, and other addresses use the customer's estimate (marked *estimate* on the booking so your team can check it). Add your most common pickups under **Places**.

## Staff roles

| Role | Can do |
|---|---|
| Admin | Everything, including pricing, content, branding and logins |
| Dispatcher | Dashboard, bookings, dispatch, enquiries; can view vehicles and drivers |
| Driver | Only their own assigned trips, at /driver |

## Good habits

- Keep "Send new booking alerts to" (Branding) set to an inbox someone watches.
- Mark drivers **Off duty** and vehicles in **Maintenance** so dispatch only picks available ones.
- Export bookings to CSV (Bookings → Export) for your accountant each month.
