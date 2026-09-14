import type {
  NormalizedSeverity,
  NormalizedIncidentStatus,
  NormalizedComponent,
  NormalizedIncident,
  NormalizedIncidentUpdate,
  NormalizedMaintenance,
} from '@/lib/types/ingestion';

export function normalizeSeverity(raw: string | undefined | null): NormalizedSeverity {
  if (!raw) return 'unknown';
  const value = raw.toLowerCase();
  if (value.includes('operational') || value === 'none' || value === 'up' || value === 'ok') {
    return 'operational';
  }
  if (value.includes('minor')) return 'degraded';
  if (value.includes('maintenance') || value.includes('maint')) return 'maintenance';
  if (value.includes('partial')) return 'partial_outage';
  if (value.includes('major') || value.includes('critical') || value.includes('outage') || value.includes('downtime')) {
    return 'major_outage';
  }
  if (value.includes('degrad') || value.includes('disruption') || value.includes('issue')) {
    return 'degraded';
  }
  if (value.includes('inform') || value.includes('info')) return 'degraded';
  return 'unknown';
}

export function normalizeIncidentStatus(raw: string | undefined | null): NormalizedIncidentStatus {
  if (!raw) return 'unknown';
  const value = raw.toLowerCase();
  if (value.includes('investigat')) return 'investigating';
  if (value.includes('identified')) return 'identified';
  if (value.includes('monitoring')) return 'monitoring';
  if (value.includes('resolved') || value.includes('complete') || value.includes('completed')) {
    return 'resolved';
  }
  if (value.includes('scheduled')) return 'scheduled';
  if (value.includes('in_progress') || value.includes('in progress')) return 'in_progress';
  if (value.includes('cancel')) return 'cancelled';
  if (value.includes('update')) return 'monitoring';
  return 'unknown';
}

export function parseStatuspageComponents(providerId: string, data: any): NormalizedComponent[] {
  const components = Array.isArray(data?.components) ? data.components : [];
  return components.map((component: any) => ({
    id: component.id || component.name,
    providerId,
    name: component.name || 'Unknown Component',
    status: normalizeSeverity(component.status),
    description: component.description || undefined,
    groupId: component.group_id || undefined,
    groupName: component.group_name || undefined,
    updatedAt: component.updated_at || undefined,
  }));
}

export function parseStatuspageIncidentUpdates(updates: any[]): NormalizedIncidentUpdate[] {
  if (!Array.isArray(updates)) return [];
  return updates.map((update) => ({
    id: update.id || update.created_at || Math.random().toString(36).slice(2),
    status: normalizeIncidentStatus(update.status),
    body: update.body || update.body_markdown || update.incident_updates || '',
    createdAt: update.created_at || new Date().toISOString(),
  }));
}

export function parseStatuspageIncidents(
  providerId: string,
  sourceId: string,
  data: any
): NormalizedIncident[] {
  const incidents = Array.isArray(data?.incidents) ? data.incidents : [];
  return incidents.map((incident: any) => ({
    id: incident.id || incident.name,
    providerId,
    sourceId,
    title: incident.name || incident.title || 'Incident',
    status: normalizeIncidentStatus(incident.status),
    severity: normalizeSeverity(incident.impact || incident.impact_override || incident.status),
    startedAt: incident.started_at || incident.created_at || new Date().toISOString(),
    updatedAt: incident.updated_at || incident.created_at || new Date().toISOString(),
    resolvedAt: incident.resolved_at || undefined,
    impactedComponents: Array.isArray(incident.components)
      ? incident.components.map((component: any) => component.id || component.name).filter(Boolean)
      : undefined,
    sourceSeverity: incident.impact || incident.impact_override || undefined,
    sourceStatus: incident.status || undefined,
    updates: parseStatuspageIncidentUpdates(incident.incident_updates || []),
    rawUrl: incident.shortlink || undefined,
  }));
}

export function parseStatuspageMaintenances(
  providerId: string,
  sourceId: string,
  data: any
): NormalizedMaintenance[] {
  const maintenances = Array.isArray(data?.scheduled_maintenances)
    ? data.scheduled_maintenances
    : Array.isArray(data?.maintenances)
      ? data.maintenances
      : [];
  return maintenances.map((maintenance: any) => ({
    id: maintenance.id || maintenance.name,
    providerId,
    sourceId,
    title: maintenance.name || maintenance.title || 'Maintenance',
    status: normalizeIncidentStatus(maintenance.status),
    severity: normalizeSeverity('maintenance'),
    scheduledFor: maintenance.scheduled_for || maintenance.started_at || maintenance.created_at || new Date().toISOString(),
    updatedAt: maintenance.updated_at || maintenance.created_at || new Date().toISOString(),
    completedAt: maintenance.completed_at || undefined,
    affectedComponents: Array.isArray(maintenance.components)
      ? maintenance.components.map((component: any) => component.id || component.name).filter(Boolean)
      : undefined,
    updates: parseStatuspageIncidentUpdates(maintenance.incident_updates || []),
  }));
}

export function parseInstatusSummary(
  providerId: string,
  sourceId: string,
  data: any
): {
  components: NormalizedComponent[];
  incidents: NormalizedIncident[];
  maintenances: NormalizedMaintenance[];
  status: NormalizedSeverity;
  statusDescription?: string;
} {
  const status = normalizeSeverity(
    data?.page?.status || data?.status?.indicator || data?.status || data?.page?.status_indicator
  );
  const components = Array.isArray(data?.components)
    ? data.components.map((component: any) => ({
        id: component.id || component.name,
        providerId,
        name: component.name || 'Component',
        status: normalizeSeverity(component.status),
        description: component.description || undefined,
        groupId: component.group_id || undefined,
        groupName: component.group_name || undefined,
        updatedAt: component.updated_at || undefined,
      }))
    : [];

  const incidents = Array.isArray(data?.incidents)
    ? data.incidents.map((incident: any) => ({
        id: incident.id || incident.name,
        providerId,
        sourceId,
        title: incident.name || incident.title || 'Incident',
        status: normalizeIncidentStatus(incident.status),
        severity: normalizeSeverity(incident.impact || incident.status || incident.severity),
        startedAt: incident.started_at || incident.created_at || new Date().toISOString(),
        updatedAt: incident.updated_at || incident.created_at || new Date().toISOString(),
        resolvedAt: incident.resolved_at || undefined,
        impactedComponents: Array.isArray(incident.components)
          ? incident.components.map((component: any) => component.id || component.name).filter(Boolean)
          : undefined,
        sourceSeverity: incident.severity || incident.impact || undefined,
        sourceStatus: incident.status || undefined,
        updates: Array.isArray(incident.updates)
          ? incident.updates.map((update: any) => ({
              id: update.id || update.created_at || Math.random().toString(36).slice(2),
              status: normalizeIncidentStatus(update.status),
              body: update.body || update.message || '',
              createdAt: update.created_at || new Date().toISOString(),
            }))
          : [],
      }))
    : [];

  const maintenances = Array.isArray(data?.scheduled_maintenances)
    ? data.scheduled_maintenances.map((maintenance: any) => ({
        id: maintenance.id || maintenance.name,
        providerId,
        sourceId,
        title: maintenance.name || 'Maintenance',
        status: normalizeIncidentStatus(maintenance.status),
        severity: normalizeSeverity('maintenance'),
        scheduledFor: maintenance.scheduled_for || maintenance.created_at || new Date().toISOString(),
        updatedAt: maintenance.updated_at || maintenance.created_at || new Date().toISOString(),
        completedAt: maintenance.completed_at || undefined,
        affectedComponents: Array.isArray(maintenance.components)
          ? maintenance.components.map((component: any) => component.id || component.name).filter(Boolean)
          : undefined,
        updates: Array.isArray(maintenance.updates)
          ? maintenance.updates.map((update: any) => ({
              id: update.id || update.created_at || Math.random().toString(36).slice(2),
              status: normalizeIncidentStatus(update.status),
              body: update.body || update.message || '',
              createdAt: update.created_at || new Date().toISOString(),
            }))
          : [],
      }))
    : [];

  return {
    components,
    incidents,
    maintenances,
    status,
    statusDescription: data?.page?.status || data?.page?.status_description,
  };
}

// Workspace dashboard descriptions open with markdown labels ("**Summary:**",
// "**Title**") followed by the actual sentence; the first real line is the title.
function cleanGoogleTitle(desc: unknown): string {
  const lines = String(desc || '')
    .split(/\r?\n/)
    .map((line) => line.replace(/\*\*/g, '').replace(/^(summary|title|description)\s*:?\s*$/i, '').trim())
    .filter(Boolean);
  return (lines[0] || '').replace(/^(summary|title)\s*:\s*/i, '').trim();
}

export function parseGoogleCloudIncidents(
  providerId: string,
  sourceId: string,
  data: any,
  productCatalog?: Map<string, string>
): NormalizedIncident[] {
  if (!Array.isArray(data)) return [];
  return data.map((incident: any) => {
    const impactedRegions = Array.isArray(incident?.currently_affected_locations)
      ? incident.currently_affected_locations.map((loc: any) => loc.id || loc.title)
      : Array.isArray(incident?.previously_affected_locations)
        ? incident.previously_affected_locations.map((loc: any) => loc.id || loc.title)
        : [];

    const impactedProducts = Array.isArray(incident?.affected_products)
      ? incident.affected_products.map((product: any) => product.id || product.title)
      : [];
    const impactedProductNames = Array.isArray(incident?.affected_products)
      ? incident.affected_products.map((product: any) => {
          const id = product.id || product.title;
          return (id && productCatalog?.get(id)) || product.title || product.id;
        })
      : [];

    const updates = Array.isArray(incident?.updates)
      ? incident.updates.map((update: any) => ({
          id: update.modified || update.created || update.when || Math.random().toString(36).slice(2),
          status: normalizeIncidentStatus(update.status),
          body: update.text || '',
          createdAt: update.when || update.created || new Date().toISOString(),
        }))
      : [];

    const severityRaw = incident.status_impact || incident.severity || incident.status || 'unknown';

    return {
      id: incident.id || incident.number,
      providerId,
      sourceId,
      title: cleanGoogleTitle(incident.external_desc) || incident.service_name || 'Incident',
      status: normalizeIncidentStatus(incident.status_impact || incident.status),
      severity: normalizeSeverity(severityRaw),
      startedAt: incident.begin || incident.created || new Date().toISOString(),
      updatedAt: incident.modified || incident.created || new Date().toISOString(),
      resolvedAt: incident.end || undefined,
      impactedRegions: impactedRegions.filter(Boolean),
      impactedComponents: impactedProducts.filter(Boolean),
      impactedComponentNames: impactedProductNames.filter(Boolean),
      sourceSeverity: severityRaw,
      sourceStatus: incident.status_impact || incident.status || undefined,
      serviceId: incident.service_key || undefined,
      serviceName: incident.service_name || undefined,
      updates,
      rawUrl: incident.uri ? `https://status.cloud.google.com/${incident.uri}` : undefined,
    };
  });
}

export function parseRssIncidents(
  providerId: string,
  sourceId: string,
  xmlText: string,
  filter?: string
): NormalizedIncident[] {
  const items = xmlText.match(/<item[\s\S]*?<\/item>/gi) || [];
  const normalizedFilter = filter ? filter.toLowerCase() : null;

  return items
    .map((item) => {
      const titleMatch = item.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const descriptionMatch = item.match(/<description[^>]*>([\s\S]*?)<\/description>/i);
      const pubDateMatch = item.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i);
      const guidMatch = item.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i);

      const title = titleMatch?.[1]?.replace(/<[^>]+>/g, '').trim() || 'Incident';
      const description = descriptionMatch?.[1]?.replace(/<[^>]+>/g, '').trim() || '';

      if (normalizedFilter && !title.toLowerCase().includes(normalizedFilter) && !description.toLowerCase().includes(normalizedFilter)) {
        return null;
      }

      const severity = normalizeSeverity(title);
      const status = normalizeIncidentStatus(title);
      const startedAt = pubDateMatch?.[1] ? new Date(pubDateMatch[1]).toISOString() : new Date().toISOString();

      return {
        id: guidMatch?.[1]?.trim() || title,
        providerId,
        sourceId,
        title,
        status,
        severity,
        startedAt,
        updatedAt: startedAt,
        updates: [
          {
            id: guidMatch?.[1]?.trim() || title,
            status,
            body: description,
            createdAt: startedAt,
          },
        ],
      } as NormalizedIncident;
    })
    .filter(Boolean) as NormalizedIncident[];
}

export function parseCachetComponents(providerId: string, data: any): NormalizedComponent[] {
  if (!Array.isArray(data?.data)) return [];
  return data.data.map((component: any) => ({
    id: String(component.id || component.name),
    providerId,
    name: component.name || 'Component',
    status: normalizeSeverity(String(component.status_name || component.status)),
    description: component.description || undefined,
    groupId: component.group_id ? String(component.group_id) : undefined,
    groupName: component.group_id ? String(component.group_id) : undefined,
    updatedAt: component.updated_at || undefined,
  }));
}

export function parseCachetIncidents(providerId: string, sourceId: string, data: any): NormalizedIncident[] {
  if (!Array.isArray(data?.data)) return [];
  return data.data.map((incident: any) => ({
    id: String(incident.id || incident.name),
    providerId,
    sourceId,
    title: incident.name || 'Incident',
    status: normalizeIncidentStatus(incident.status || incident.status_name),
    severity: normalizeSeverity(incident.impact || incident.impact_name || incident.status_name),
    startedAt: incident.created_at || new Date().toISOString(),
    updatedAt: incident.updated_at || incident.created_at || new Date().toISOString(),
    resolvedAt: incident.resolved_at || undefined,
    impactedComponents: Array.isArray(incident.components)
      ? incident.components.map((component: any) => String(component.id || component.name))
      : undefined,
    updates: [],
  }));
}

export function parseStatusIo(
  providerId: string,
  sourceId: string,
  data: any
): {
  status: NormalizedSeverity;
  components: NormalizedComponent[];
  incidents: NormalizedIncident[];
  maintenances: NormalizedMaintenance[];
} {
  const statusRaw = data?.result?.status?.description || data?.result?.status?.status || data?.status?.description;
  const components = Array.isArray(data?.result?.components)
    ? data.result.components.map((component: any) => ({
        id: component.id || component.name,
        providerId,
        name: component.name || 'Component',
        status: normalizeSeverity(component.status || component.status_description || component.status_code),
        description: component.description || undefined,
        groupId: component.group_id || undefined,
        groupName: component.group_name || undefined,
        updatedAt: component.updated_at || undefined,
      }))
    : [];

  const incidents = Array.isArray(data?.result?.incidents)
    ? data.result.incidents.map((incident: any) => ({
        id: incident.id || incident.name,
        providerId,
        sourceId,
        title: incident.name || 'Incident',
        status: normalizeIncidentStatus(incident.status || incident.state),
        severity: normalizeSeverity(incident.status || incident.status_description),
        startedAt: incident.created_at || new Date().toISOString(),
        updatedAt: incident.updated_at || incident.created_at || new Date().toISOString(),
        resolvedAt: incident.resolved_at || undefined,
        impactedComponents: Array.isArray(incident.components)
          ? incident.components.map((component: any) => component.id || component.name)
          : undefined,
        updates: Array.isArray(incident.messages)
          ? incident.messages.map((message: any) => ({
              id: message.id || message.created_at || Math.random().toString(36).slice(2),
              status: normalizeIncidentStatus(message.status || message.state),
              body: message.body || message.details || '',
              createdAt: message.created_at || new Date().toISOString(),
            }))
          : [],
      }))
    : [];

  const maintenances = Array.isArray(data?.result?.maintenances)
    ? data.result.maintenances.map((maintenance: any) => ({
        id: maintenance.id || maintenance.name,
        providerId,
        sourceId,
        title: maintenance.name || 'Maintenance',
        status: normalizeIncidentStatus(maintenance.status || maintenance.state),
        severity: normalizeSeverity('maintenance'),
        scheduledFor: maintenance.scheduled_for || maintenance.created_at || new Date().toISOString(),
        updatedAt: maintenance.updated_at || maintenance.created_at || new Date().toISOString(),
        completedAt: maintenance.completed_at || undefined,
        affectedComponents: Array.isArray(maintenance.components)
          ? maintenance.components.map((component: any) => component.id || component.name)
          : undefined,
        updates: Array.isArray(maintenance.messages)
          ? maintenance.messages.map((message: any) => ({
              id: message.id || message.created_at || Math.random().toString(36).slice(2),
              status: normalizeIncidentStatus(message.status || message.state),
              body: message.body || message.details || '',
              createdAt: message.created_at || new Date().toISOString(),
            }))
          : [],
      }))
    : [];

  return {
    status: normalizeSeverity(statusRaw),
    components,
    incidents,
    maintenances,
  };
}

export function parseBetterstackIndex(
  providerId: string,
  sourceId: string,
  data: any
): {
  status: NormalizedSeverity;
  statusDescription?: string;
  components: NormalizedComponent[];
  incidents: NormalizedIncident[];
  maintenances: NormalizedMaintenance[];
} {
  const statusRaw = data?.data?.attributes?.aggregate_state || data?.data?.attributes?.status;
  const included = Array.isArray(data?.included) ? data.included : [];
  const sectionMap = new Map<string, string>();

  included
    .filter((item: any) => item?.type === 'status_page_section')
    .forEach((section: any) => {
      if (section?.id && section?.attributes?.name) {
        sectionMap.set(String(section.id), String(section.attributes.name));
      }
    });

  const components = included
    .filter((item: any) => item?.type === 'status_page_resource')
    .map((resource: any) => {
      const attrs = resource?.attributes || {};
      const sectionId = attrs.status_page_section_id ? String(attrs.status_page_section_id) : undefined;
      return {
        id: String(resource?.id || attrs.resource_id || attrs.public_name || 'unknown'),
        providerId,
        name: String(attrs.public_name || attrs.name || 'Component'),
        status: normalizeSeverity(attrs.status || attrs.state),
        description: attrs.explanation || undefined,
        groupId: sectionId,
        groupName: sectionId ? sectionMap.get(sectionId) : undefined,
        updatedAt: attrs.updated_at || data?.data?.attributes?.updated_at || undefined,
      } as NormalizedComponent;
    });

  return {
    status: normalizeSeverity(statusRaw),
    statusDescription: typeof statusRaw === 'string' ? statusRaw : undefined,
    components,
    incidents: [],
    maintenances: [],
  };
}
