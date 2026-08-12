import type { AdminResource, PermissionAction, PermissionSchema, StaffPermission } from '@/types/api';

/** Plain-English names for the sections, matching the sidebar. */
const RESOURCE_LABEL: Record<AdminResource, string> = {
  DASHBOARD: 'Overview',
  CALENDAR: 'Calendar',
  APPOINTMENTS: 'Appointments',
  CLIENTS: 'Clients',
  SERVICES: 'Services',
  AVAILABILITY: 'Availability',
  GALLERY: 'Gallery',
  INSTAGRAM: 'Instagram',
  SETTINGS: 'Settings',
};

/**
 * What each section's write actions actually let someone do, so the owner is
 * granting a capability rather than ticking an abstract box.
 */
const RESOURCE_HINT: Partial<Record<AdminResource, string>> = {
  APPOINTMENTS: 'Add books clients in · Edit approves, moves and completes · Delete cancels',
  CLIENTS: 'Includes treatment photos and documents',
  AVAILABILITY: 'Opening hours and closures',
  SETTINGS: 'The booking-engine panel. Everyone can always reach their own account and notifications.',
};

const ACTION_LABEL: Record<PermissionAction, string> = {
  VIEW: 'View',
  CREATE: 'Add',
  EDIT: 'Edit',
  DELETE: 'Delete',
};

interface PermissionGridProps {
  schema: PermissionSchema;
  value: StaffPermission[];
  onChange: (next: StaffPermission[]) => void;
  disabled?: boolean;
}

function actionsFor(value: StaffPermission[], resource: AdminResource): PermissionAction[] {
  return value.find((entry) => entry.resource === resource)?.actions ?? [];
}

/**
 * The access matrix: one row per admin section, one checkbox per action.
 *
 * View is the hinge. Clearing it drops the whole row — a section that cannot be
 * opened but can be written to is not a state worth being able to express, and
 * the server normalises it away regardless.
 */
export function PermissionGrid({ schema, value, onChange, disabled }: PermissionGridProps) {
  const toggle = (resource: AdminResource, action: PermissionAction, checked: boolean) => {
    const current = new Set(actionsFor(value, resource));

    if (action === 'VIEW' && !checked) {
      onChange(value.filter((entry) => entry.resource !== resource));
      return;
    }

    if (checked) {
      current.add(action);
      // Granting a write implies the section can be opened, so View comes along
      // rather than leaving a grant that does nothing.
      current.add('VIEW');
    } else {
      current.delete(action);
    }

    const others = value.filter((entry) => entry.resource !== resource);
    const actions = schema.actions.filter((entry) => current.has(entry));
    onChange(
      actions.length > 0 ? [...others, { resource, actions }] : others,
    );
  };

  return (
    <div className="nu-permgrid-wrap">
      <table className="nu-permgrid">
        <thead>
          <tr>
            <th scope="col">Section</th>
            {schema.actions.map((action) => (
              <th key={action} scope="col">
                {ACTION_LABEL[action]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {schema.resources.map((resource) => {
            const granted = actionsFor(value, resource);
            const readOnly = schema.readOnlyResources.includes(resource);

            return (
              <tr key={resource}>
                <th scope="row">
                  <span className="nu-permgrid__name">{RESOURCE_LABEL[resource] ?? resource}</span>
                  {RESOURCE_HINT[resource] && (
                    <span className="nu-permgrid__hint">{RESOURCE_HINT[resource]}</span>
                  )}
                </th>

                {schema.actions.map((action) => {
                  // Nothing is created, edited or deleted in a read-only
                  // section, so the box is omitted rather than shown disabled.
                  if (readOnly && action !== 'VIEW') {
                    return (
                      <td key={action} aria-hidden="true">
                        <span className="nu-permgrid__na">—</span>
                      </td>
                    );
                  }

                  return (
                    <td key={action}>
                      <label className="nu-permgrid__box">
                        <input
                          type="checkbox"
                          checked={granted.includes(action)}
                          disabled={disabled}
                          onChange={(event) => toggle(resource, action, event.target.checked)}
                        />
                        <span className="nu-sr-only">
                          {ACTION_LABEL[action]} {RESOURCE_LABEL[resource] ?? resource}
                        </span>
                      </label>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** One-line summary of a permission set, for the staff list. */
export function summarisePermissions(permissions: StaffPermission[]): string {
  if (permissions.length === 0) return 'No sections';
  return permissions
    .map((entry) => RESOURCE_LABEL[entry.resource] ?? entry.resource)
    .join(', ');
}
