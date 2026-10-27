import './vehicle-website-link.css'

export function VehicleWebsiteLink({ website }: { website: { url: string; label: string } }) {
  return <a className="vehicle-website-link" href={website.url} target="_blank" rel="noopener noreferrer"
    aria-label={`前往官网了解车型：${website.label}（新标签页打开）`}>
    前往官网了解车型
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7 17 17 7M7 7h10v10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </a>
}
