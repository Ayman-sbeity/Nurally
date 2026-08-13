import { useState } from 'react';
import { BUSINESS } from '@/content/business';
import { Reveal } from '@/components/ui/Reveal';

/**
 * WHERE THE LOUNGE IS
 * -------------------
 * Address, hours and a map, for the visitor who has decided to come and now
 * needs to find the door.
 *
 * The whole section is omitted until an address or coordinates are configured.
 * That follows the rule the rest of the content obeys: nothing about Nurella is
 * invented, and an empty "Visit us" heading over a blank map is worse than no
 * section at all. See `docs/GEO-NAP-AUDIT.md`.
 *
 * The map is **click-to-load**. Embedding Google's iframe outright would put a
 * third-party request, its cookies and roughly a megabyte of script on the
 * first paint of the landing page — paid by every visitor, including the
 * majority who never look at the map. The facade costs one click from the few
 * who want it.
 */

/** Coordinates beat text: an embed built from a name can land on the wrong branch. */
function embedUrl(): string | null {
  if (BUSINESS.geo) {
    const { latitude, longitude } = BUSINESS.geo;
    return `https://www.google.com/maps?q=${latitude},${longitude}&z=16&output=embed`;
  }
  if (BUSINESS.addressLine) {
    return `https://www.google.com/maps?q=${encodeURIComponent(
      `${BUSINESS.name} ${BUSINESS.addressLine}`,
    )}&z=16&output=embed`;
  }
  return null;
}

/**
 * Where "Get directions" goes. The lounge's own Google listing is best — it
 * opens the profile with reviews and photos, and every visit is a signal that
 * the listing is the real one — with a plain pin as the fallback.
 */
function directionsUrl(): string | null {
  if (BUSINESS.mapUrl) return BUSINESS.mapUrl;
  if (BUSINESS.googleProfileUrl) return BUSINESS.googleProfileUrl;
  if (BUSINESS.geo) {
    const { latitude, longitude } = BUSINESS.geo;
    return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
  }
  if (BUSINESS.addressLine) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
      `${BUSINESS.name} ${BUSINESS.addressLine}`,
    )}`;
  }
  return null;
}

export function LocationSection() {
  const [mapLoaded, setMapLoaded] = useState(false);

  const map = embedUrl();
  const directions = directionsUrl();

  // Nothing to show until the lounge's address is configured.
  if (!map && !directions && !BUSINESS.addressLine) return null;

  return (
    <section className="nu-section nu-section--sand" id="visit" aria-labelledby="visit-title">
      <div className="nu-container">
        <Reveal>
          <p className="nu-eyebrow">VISIT US</p>
          <h2 className="nu-h2" id="visit-title">
            Find the lounge
          </h2>
        </Reveal>

        <div className="nu-location">
          <Reveal className="nu-location__details">
            <address className="nu-location__nap">
              {BUSINESS.addressLine && (
                <p className="nu-location__address">{BUSINESS.addressLine}</p>
              )}
              {BUSINESS.telephone && (
                <p>
                  <a href={`tel:${BUSINESS.telephone.replace(/\s+/g, '')}`}>{BUSINESS.telephone}</a>
                </p>
              )}
              {BUSINESS.email && (
                <p>
                  <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a>
                </p>
              )}
              {BUSINESS.hoursLine && <p className="nu-hint">{BUSINESS.hoursLine}</p>}
            </address>

            {directions && (
              <div className="nu-location__actions">
                <a
                  className="nu-btn nu-btn--outline"
                  href={directions}
                  target="_blank"
                  // `noopener` is what matters — a tab opened with `target`
                  // otherwise keeps a handle on this one.
                  rel="noopener noreferrer"
                >
                  Get directions
                </a>
              </div>
            )}
          </Reveal>

          <Reveal className="nu-location__map">
            {map && !mapLoaded && (
              <button
                type="button"
                className="nu-map-facade"
                onClick={() => setMapLoaded(true)}
                aria-label={`Load the Google map showing ${BUSINESS.name}`}
              >
                <span className="nu-map-facade__pin" aria-hidden="true">
                  ◉
                </span>
                <span className="nu-map-facade__label">Show map</span>
                <span className="nu-map-facade__note">
                  Loads Google Maps, which sets its own cookies.
                </span>
              </button>
            )}

            {map && mapLoaded && (
              <iframe
                title={`Map showing ${BUSINESS.name}`}
                src={map}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
              />
            )}
          </Reveal>
        </div>
      </div>
    </section>
  );
}
