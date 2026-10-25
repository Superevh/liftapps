import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

// A QR code for joining a board from a phone, drawn in brand ink on ivory.
export function QR({ text, size = 160, dark = '#2B1E14', light = '#F7F1E6' }) {
  const [src, setSrc] = useState(null)
  useEffect(() => {
    let live = true
    QRCode.toDataURL(text, { margin: 1, width: size * 2, color: { dark, light } }).then(url => { if (live) setSrc(url) }).catch(() => {})
    return () => { live = false }
  }, [text, size, dark, light])
  return src ? <img className="qr" src={src} width={size} height={size} alt="QR code" /> : <span className="qr" style={{ width: size, height: size }} />
}
