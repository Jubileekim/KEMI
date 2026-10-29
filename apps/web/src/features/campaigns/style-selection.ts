export const MAX_CAMPAIGN_STYLES = 5;

/** Enforce the same five-style limit before submitting a campaign. */
export default function toggleCampaignStyle(
  selected: string[],
  style: string,
  checked: boolean,
): string[] {
  if (!checked) return selected.filter((value) => value !== style);
  if (selected.includes(style) || selected.length >= MAX_CAMPAIGN_STYLES)
    return selected;
  return [...selected, style];
}
