import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { Icon } from '@/components/ui/Icon';
import { categoryIcon } from '@/content/brand';
import type { ServiceCategory } from '@/types/api';

/** Where the reader's eye sits: a category is "current" once its top passes this line. */
const READING_LINE = 0.35;

interface CategoryNavProps {
  categories: Pick<ServiceCategory, 'slug' | 'label'>[];
  /** The id the "All treatments" link returns to. */
  topId: string;
}

/**
 * The category bar on the Treatments page.
 *
 * Plain in-page links rather than a filter: every treatment stays on the page
 * and in what a search engine reads, each category can be linked to directly,
 * and it all works before any script runs. Script only adds the highlight that
 * follows the reader down the page, and keeps that chip in view on a phone,
 * where the bar scrolls sideways.
 */
export function CategoryNav({ categories, topId }: CategoryNavProps) {
  const reduceMotion = useReducedMotion();
  const [active, setActive] = useState<string | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const sections = categories
      .map((category) => document.getElementById(`category-${category.slug}`))
      .filter((section): section is HTMLElement => section !== null);

    let frame = 0;
    const update = () => {
      frame = 0;
      const line = window.innerHeight * READING_LINE;
      let current: string | null = null;
      for (const section of sections) {
        if (section.getBoundingClientRect().top <= line) current = section.id.slice('category-'.length);
      }
      setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [categories]);

  useEffect(() => {
    const list = listRef.current;
    const chip = list?.querySelector<HTMLElement>('[aria-current]');
    if (!list || !chip) return;
    list.scrollTo({
      left: chip.offsetLeft - (list.clientWidth - chip.offsetWidth) / 2,
      behavior: reduceMotion ? 'auto' : 'smooth',
    });
  }, [active, reduceMotion]);

  return (
    <nav className="nu-category-nav" aria-label="Treatment categories">
      <ul ref={listRef} className="nu-category-nav__list">
        <li>
          <a
            href={`#${topId}`}
            className="nu-category-nav__link"
            aria-current={active === null ? 'location' : undefined}
          >
            <Icon name="grid" />
            All treatments
          </a>
        </li>
        {categories.map((category) => (
          <li key={category.slug}>
            <a
              href={`#category-${category.slug}`}
              className="nu-category-nav__link"
              aria-current={active === category.slug ? 'location' : undefined}
            >
              <Icon name={categoryIcon(category.slug)} />
              {category.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
