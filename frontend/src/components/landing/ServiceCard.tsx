import { Link, useNavigate } from 'react-router-dom';
import { categoryImage } from '@/content/brand';
import { useAuth } from '@/context/AuthContext';
import type { Service } from '@/types/api';
import { formatDuration, formatPrice } from '@/utils/format';
import { mediaSrc } from '@/utils/media';

/** Where a "book this" action should go, given the visitor's auth state. */
export function useBookService() {
  const navigate = useNavigate();
  const { isAuthenticated, isAdmin } = useAuth();

  return (serviceId: string) => {
    const target = `/app/book?serviceId=${serviceId}`;
    if (isAuthenticated && !isAdmin) {
      navigate(target);
      return;
    }
    if (isAdmin) {
      navigate('/admin/calendar');
      return;
    }
    // Sign in first, then continue straight into the booking flow.
    navigate('/login', { state: { from: target } });
  };
}

export function ServiceCard({ service }: { service: Service }) {
  const bookService = useBookService();
  const price = formatPrice(service.price, service.currency);
  /* Every card shows artwork: the service's own when set, its category's otherwise. */
  const image = mediaSrc(service.imageUrl ?? categoryImage(service.category));

  return (
    <article className="nu-service-card">
      {/* Decorative — the heading link below is the accessible route to the service. */}
      <Link
        to={`/services/${service.slug}`}
        className="nu-service-card__media"
        tabIndex={-1}
        aria-hidden="true"
      >
        <img src={image} alt="" width={960} height={480} loading="lazy" decoding="async" />
      </Link>

      <h3 className="nu-service-card__name">
        <Link to={`/services/${service.slug}`}>{service.name}</Link>
      </h3>

      {service.description && <p className="nu-service-card__desc">{service.description}</p>}

      <div className="nu-service-card__foot">
        <span className="nu-service-card__meta">
          {formatDuration(service.durationMinutes)}
          {/* A price is shown only when the lounge has configured one. */}
          {price && ` · ${price}`}
        </span>
        <button
          type="button"
          className="nu-btn nu-btn--outline nu-btn--sm"
          onClick={() => bookService(service._id)}
        >
          Book this service
        </button>
      </div>
    </article>
  );
}
