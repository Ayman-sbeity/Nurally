import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import type { Service } from '@/types/api';
import { formatDuration, formatPrice } from '@/utils/format';

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

  return (
    <article className="nu-service-card">
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
