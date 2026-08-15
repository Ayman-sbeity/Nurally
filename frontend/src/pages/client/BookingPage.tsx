import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { bookingApi } from '@/api/booking.api';
import { ApiRequestError } from '@/api/client';
import { catalogueApi } from '@/api/catalogue.api';
import { Button } from '@/components/ui/Button';
import { TextAreaField } from '@/components/ui/Field';
import { Seo } from '@/components/ui/Seo';
import { BOOKING_STEPS, StepIndicator } from '@/components/booking/StepIndicator';
import { ServiceStep } from '@/components/booking/ServiceStep';
import { DateStep } from '@/components/booking/DateStep';
import { TimeStep } from '@/components/booking/TimeStep';
import { qk } from '@/hooks/queries';
import type { Appointment, Service } from '@/types/api';
import { formatDateTime, formatDuration, formatPrice } from '@/utils/format';

type Step = 0 | 1 | 2 | 3;

export function BookingPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<Step>(0);
  const [service, setService] = useState<Service | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [conflict, setConflict] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<Appointment | null>(null);

  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  // Skips the very first render: stealing focus on arrival would drag the
  // page down past the heading the client just navigated to.
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    stepHeadingRef.current?.focus();
  }, [step]);

  /** Steps only ever move backwards by hand; forward movement is a selection. */
  const goTo = (target: Step) => {
    setConflict(null);
    setStep(target);
  };

  // Deep link from the landing page: /app/book?serviceId=…
  const presetServiceId = searchParams.get('serviceId');
  useEffect(() => {
    if (!presetServiceId || service) return;
    let cancelled = false;
    catalogueApi
      .getService(presetServiceId)
      .then(({ service: found }) => {
        if (cancelled) return;
        setService(found);
        setStep(1);
      })
      .catch(() => {
        // An unknown or inactive service simply starts the flow at step one.
        if (!cancelled) setSearchParams({}, { replace: true });
      });
    return () => {
      cancelled = true;
    };
  }, [presetServiceId, service, setSearchParams]);

  const createBooking = useMutation({
    mutationFn: () =>
      bookingApi.create({
        serviceId: service!._id,
        startAt: slot!,
        ...(notes.trim() ? { clientNotes: notes.trim() } : {}),
      }),
    onSuccess: ({ appointment }) => {
      setSubmitted(appointment);
      void queryClient.invalidateQueries({ queryKey: ['my-appointments'] });
      void queryClient.invalidateQueries({ queryKey: qk.notifications });
    },
    onError: (error) => {
      if (
        error instanceof ApiRequestError &&
        (error.code === 'BOOKING_CONFLICT' || error.code === 'SLOT_UNAVAILABLE')
      ) {
        // Someone took the slot while this client was reviewing. Send them
        // back to a freshly loaded slot list rather than failing silently.
        setConflict(error.message);
        setSlot(null);
        setStep(2);
        void queryClient.invalidateQueries({ queryKey: ['availability'] });
      }
    },
  });

  // --- Step 6: confirmation ------------------------------------------------
  if (submitted) {
    return (
      <>
        <Seo title="Request submitted — Nurella" noIndex />
        <div className="nu-stack" style={{ gap: 'var(--nu-space-5)' }}>
          <div className="nu-page-head">
            <h1 className="nu-page-head__title">Your appointment request has been submitted.</h1>
          </div>

          <div className="nu-notice nu-notice--warn" role="status">
            <div>
              <p style={{ fontWeight: 500 }}>Pending approval</p>
              <p style={{ marginTop: 'var(--nu-space-2)' }}>
                Your appointment is <strong>not confirmed</strong> until Nurella Beauty Lounge
                approves it. We will let you know as soon as it is reviewed.
              </p>
            </div>
          </div>

          <div className="nu-summary">
            <div className="nu-summary__row">
              <span className="nu-summary__label">Treatment</span>
              <span className="nu-summary__value">{submitted.serviceNameSnapshot}</span>
            </div>
            <div className="nu-summary__row">
              <span className="nu-summary__label">Requested time</span>
              <span className="nu-summary__value">{formatDateTime(submitted.startAt)}</span>
            </div>
            <div className="nu-summary__row">
              <span className="nu-summary__label">Duration</span>
              <span className="nu-summary__value">{formatDuration(submitted.durationMinutes)}</span>
            </div>
          </div>

          <div className="nu-row" style={{ gap: 'var(--nu-space-3)' }}>
            <Link to={`/app/appointments/${submitted._id}`} className="nu-btn nu-btn--primary" style={{ flex: 1 }}>
              View request
            </Link>
            <Link to="/app" className="nu-btn nu-btn--outline" style={{ flex: 1 }}>
              Done
            </Link>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Seo title="Book an appointment — Nurella" noIndex />

      <div className="nu-page-head">
        <h1 className="nu-page-head__title">Book an appointment</h1>
        <p className="nu-page-head__sub">
          Requests are reviewed by the lounge before they are confirmed.
        </p>
      </div>

      <StepIndicator current={step} onGoTo={(target) => goTo(target as Step)} />

      {/* Announces the step change to screen readers and takes focus, so a
          keyboard user is not left at the top of a page whose content has
          silently swapped underneath them. */}
      <h2 className="nu-sr-only" tabIndex={-1} ref={stepHeadingRef}>
        Step {step + 1} of {BOOKING_STEPS.length}: {BOOKING_STEPS[step]}
      </h2>

      {conflict && (
        <div className="nu-notice nu-notice--danger" role="alert" style={{ marginBottom: 'var(--nu-space-5)' }}>
          {conflict}
        </div>
      )}

      {createBooking.isError && !conflict && (
        <div className="nu-notice nu-notice--danger" role="alert" style={{ marginBottom: 'var(--nu-space-5)' }}>
          {createBooking.error instanceof ApiRequestError
            ? createBooking.error.message
            : 'We could not submit your request. Please try again.'}
        </div>
      )}

      {step === 0 && (
        <ServiceStep
          selectedId={service?._id ?? null}
          onSelect={(selected) => {
            setService(selected);
            setDate(null);
            setSlot(null);
            setStep(1);
          }}
        />
      )}

      {step === 1 && service && (
        <DateStep
          serviceId={service._id}
          availableWeekdays={service.availableWeekdays}
          selectedDate={date}
          onSelect={(selected) => {
            setDate(selected);
            setSlot(null);
            setConflict(null);
            setStep(2);
          }}
        />
      )}

      {step === 2 && service && date && (
        <TimeStep
          serviceId={service._id}
          date={date}
          selectedSlot={slot}
          onChangeDate={() => setStep(1)}
          onSelect={(selected) => {
            setSlot(selected);
            setConflict(null);
            setStep(3);
          }}
        />
      )}

      {step === 3 && service && slot && (
        <div className="nu-stack" style={{ gap: 'var(--nu-space-5)' }}>
          {/* Each answer is editable from where it is shown. Previously the
              only way back was repeated presses of Back, which meant losing
              the later answers to correct an earlier one. */}
          <div className="nu-summary">
            <div className="nu-summary__row">
              <span className="nu-summary__label">Treatment</span>
              <span className="nu-summary__value">
                {service.name}
                <button type="button" className="nu-summary__edit" onClick={() => goTo(0)}>
                  Change<span className="nu-sr-only"> treatment</span>
                </button>
              </span>
            </div>
            <div className="nu-summary__row">
              <span className="nu-summary__label">When</span>
              <span className="nu-summary__value">
                {formatDateTime(slot)}
                <button type="button" className="nu-summary__edit" onClick={() => goTo(2)}>
                  Change<span className="nu-sr-only"> time</span>
                </button>
              </span>
            </div>
            <div className="nu-summary__row">
              <span className="nu-summary__label">Duration</span>
              <span className="nu-summary__value">{formatDuration(service.durationMinutes)}</span>
            </div>
            {/* Only where the lounge has set a price. Most treatments are
                quoted at the consultation, and a blank row would read as free. */}
            {formatPrice(service.price, service.currency) && (
              <div className="nu-summary__row">
                <span className="nu-summary__label">Price</span>
                <span className="nu-summary__value">
                  {formatPrice(service.price, service.currency)}
                </span>
              </div>
            )}
          </div>

          <TextAreaField
            label="Anything we should know? (optional)"
            value={notes}
            maxLength={1000}
            onChange={(event) => setNotes(event.target.value)}
            hint="Allergies, preferences, or a note for your consultation."
          />

          <div className="nu-notice">
            Submitting sends a request. Nurella Beauty Lounge will approve it, propose another time,
            or contact you.
          </div>

          <Button
            block
            loading={createBooking.isPending}
            onClick={() => createBooking.mutate()}
          >
            Submit request
          </Button>
        </div>
      )}

      {/* Back only. Choosing a service, a date or a time advances the flow by
          itself, so a "Continue" button here could never be reached in an
          enabled state — it was permanently greyed out, which read as the flow
          being stuck. The one place an explicit commit is needed is the review
          step, where "Submit request" lives. */}
      <div className="nu-row" style={{ marginTop: 'var(--nu-space-6)' }}>
        <Button
          variant="ghost"
          onClick={() => (step === 0 ? navigate('/app') : goTo((step - 1) as Step))}
        >
          {step === 0 ? 'Cancel' : `Back to ${BOOKING_STEPS[step - 1]}`}
        </Button>
      </div>
    </>
  );
}

export default BookingPage;
