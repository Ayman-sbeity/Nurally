import { Link, useNavigate } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import { categoryImage } from '@/content/brand';
import { useAuth } from '@/context/AuthContext';
import type { Service } from '@/types/api';
import { formatDuration, formatPrice } from '@/utils/format';
import { mediaSrc } from '@/utils/media';

/** Where a "book this" action should go, given the visitor's auth state. */
export function useBookService() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoungeSide } = useAuth();

  return (serviceId: string) => {
    const target = `/app/book?serviceId=${serviceId}`;
    if (isAuthenticated && !isLoungeSide) {
      navigate(target);
      return;
    }
    if (isLoungeSide) {
      navigate('/admin/calendar');
      return;
    }
    // Sign in first, then continue straight into the booking flow.
    navigate('/login', { state: { from: target } });
  };
}

interface ServiceCardProps {
  service: Service;
  /** One level below the heading of the list the card sits in. */
  headingLevel?: 'h3' | 'h4';
}

export function ServiceCard({ service, headingLevel: Heading = 'h3' }: ServiceCardProps) {
  const bookService = useBookService();
  const price = formatPrice(service.price, service.currency);
  /* The treatment's own photo when one is saved, its category's artwork otherwise.
     `||`, not `??`: a cleared image field arrives as an empty string. */
  const image = mediaSrc(service.imageUrl || categoryImage(service.category));

  return (
    <article className="nu-service-card">
      {/* Decorative — the name below says what the picture shows. */}
      <div className="nu-service-card__media">
        <img src={image} alt="" width={960} height={720} loading="lazy" decoding="async" />
      </div>

      <div className="nu-service-card__body">
        <Heading className="nu-service-card__name">
          {/* Stretched over the whole card, so picture and text are one target. */}
          <Link to={`/services/${service.slug}`} className="nu-service-card__link">
            {service.name}
          </Link>
        </Heading>

        {service.description && <p className="nu-service-card__desc">{service.description}</p>}

        <p className="nu-service-card__meta">
          <span>
            <Icon name="clock" />
            {formatDuration(service.durationMinutes)}
          </span>
          {/* A price is shown only when the lounge has configured one. */}
          {price && <span className="nu-service-card__price">{price}</span>}
        </p>

        <button
          type="button"
          className="nu-btn nu-btn--primary nu-btn--sm nu-service-card__book"
          onClick={() => bookService(service._id)}
        >
          Book now
          {/* Every card has this button; the name tells them apart for a screen reader. */}
          <span className="nu-sr-only"> — {service.name}</span>
          <Icon name="arrow" />
        </button>
      </div>
    </article>
  );
}
