// BreadcrumbList JSON-LD so Google shows a breadcrumb trail in results.
export function breadcrumbLd(trail: Array<{ name: string; path: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((t, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: t.name,
      item: `https://aistatusdashboard.com${t.path}`,
    })),
  };
}
