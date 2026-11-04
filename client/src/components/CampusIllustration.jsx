// Original, local artwork: no external image requests or stock-photo dependency.
export default function CampusIllustration({ className = "" }) {
  return <svg className={`campus-illustration ${className}`} viewBox="0 0 600 340" fill="none" aria-hidden="true" focusable="false">
    <circle cx="307" cy="160" r="135" fill="currentColor" opacity=".05" />
    <circle cx="307" cy="160" r="106" stroke="currentColor" strokeDasharray="3 9" opacity=".15" />
    <path d="M63 290H545M88 304H520" stroke="#9AB8B9" strokeOpacity=".35" strokeLinecap="round" />
    <path d="M120 174H239V286H120z" fill="#719A98" /><path d="M370 174H489V286H370z" fill="#719A98" />
    <path d="M108 174L180 135L250 174H108ZM360 174L430 135L500 174H360Z" fill="#456D73" />
    <path d="M226 143H383V286H226z" fill="#E8E9D9" />
    <path d="M210 144L304 88L399 144H210Z" fill="#F2BC6B" />
    <path d="M233 138L304 97L376 138H233Z" stroke="#BD8A4B" strokeWidth="2" />
    <path d="M304 88V48" stroke="#E8E9D9" strokeWidth="3" />
    <path d="M306 48H343L332 60L343 72H306V48Z" fill="#E8AD62" />
    <circle cx="305" cy="173" r="17" fill="#234C57" /><path d="M305 162V173L313 178" stroke="#F4D5A4" strokeWidth="2.5" strokeLinecap="round" />
    {[249, 278, 323, 352].map(x => <g key={x}><path d={`M${x} 204V267`} stroke="#A6B7AD" strokeWidth="9" /><path d={`M${x - 7} 200H${x + 7}M${x - 7} 272H${x + 7}`} stroke="#BCC7B9" strokeWidth="4" /></g>)}
    <path d="M290 285V247C290 227 320 227 320 247V285" fill="#234C57" />
    {[140, 179, 390, 429, 465].map(x => <g key={x}><rect x={x} y="194" width="13" height="23" rx="6.5" fill="#234C57" /><rect x={x} y="236" width="13" height="23" rx="6.5" fill="#234C57" /></g>)}
    <path d="M215 286H394M207 293H402" stroke="#CAD1BF" strokeWidth="6" />
    <path d="M87 284V230M524 284V230" stroke="#A6B7AD" strokeWidth="5" />
    <path d="M65 238C44 212 70 202 67 187C63 166 107 166 107 190C107 204 130 218 106 239C95 249 76 250 65 238Z" fill="#477D70" />
    <path d="M502 238C481 212 507 202 504 187C500 166 544 166 544 190C544 204 567 218 543 239C532 249 513 250 502 238Z" fill="#477D70" />
    <path d="M94 94L123 86L151 95L123 104L94 94Z" fill="#E8AD62" /><path d="M107 100V111Q123 121 139 111V100M151 95V114" stroke="#E8AD62" strokeWidth="2" />
    <path d="M441 82Q457 73 472 83V109Q457 99 441 108V82ZM472 83Q488 73 503 82V108Q488 99 472 109V83Z" stroke="#94B9AF" strokeWidth="2" />
    <path d="M184 65L188 74L197 78L188 82L184 91L180 82L171 78L180 74L184 65ZM416 122L419 128L425 131L419 134L416 140L413 134L407 131L413 128L416 122Z" fill="#E8AD62" />
    <path d="M277 312L293 298H317L333 312" fill="#E8AD62" opacity=".3" />
  </svg>;
}
