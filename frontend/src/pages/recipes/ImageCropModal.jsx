import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Modal } from '../../components'

const MIN_SIZE = 40
const HANDLE_HIT = 12  // px radius for hit-testing handles

// Eight handle positions
const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }

function getCursor(handle) {
  const map = { nw: 'nw-resize', n: 'n-resize', ne: 'ne-resize', e: 'e-resize', se: 'se-resize', s: 's-resize', sw: 'sw-resize', w: 'w-resize' }
  return map[handle] || 'default'
}

function handleCenter(box, handle) {
  const { x, y, w, h } = box
  switch (handle) {
    case 'nw': return [x, y]
    case 'n':  return [x + w / 2, y]
    case 'ne': return [x + w, y]
    case 'e':  return [x + w, y + h / 2]
    case 'se': return [x + w, y + h]
    case 's':  return [x + w / 2, y + h]
    case 'sw': return [x, y + h]
    case 'w':  return [x, y + h / 2]
    default:   return [0, 0]
  }
}

function hitHandle(box, px, py) {
  for (const h of HANDLES) {
    const [hx, hy] = handleCenter(box, h)
    const dx = px - hx
    const dy = py - hy
    if (dx * dx + dy * dy <= HANDLE_HIT * HANDLE_HIT) return h
  }
  return null
}

function insideBox(box, px, py) {
  return px >= box.x && px <= box.x + box.w && py >= box.y && py <= box.y + box.h
}

function resizeBox(box, handle, dx, dy, imgW, imgH) {
  let { x, y, w, h } = box
  if (handle.includes('n')) { y += dy; h -= dy }
  if (handle.includes('s')) { h += dy }
  if (handle.includes('w')) { x += dx; w -= dx }
  if (handle.includes('e')) { w += dx }
  // Enforce minimum
  if (w < MIN_SIZE) { if (handle.includes('w')) { x = box.x + box.w - MIN_SIZE } w = MIN_SIZE }
  if (h < MIN_SIZE) { if (handle.includes('n')) { y = box.y + box.h - MIN_SIZE } h = MIN_SIZE }
  // Clamp to image
  x = clamp(x, 0, imgW - MIN_SIZE)
  y = clamp(y, 0, imgH - MIN_SIZE)
  w = clamp(w, MIN_SIZE, imgW - x)
  h = clamp(h, MIN_SIZE, imgH - y)
  return { x, y, w, h }
}

export function ImageCropModal({ open, src, onClose, onCrop }) {
  const canvasRef = useRef(null)
  const imgRef = useRef(null)

  // box is in *canvas* coordinates
  const [box, setBox] = useState(null)
  const [imgReady, setImgReady] = useState(false)

  // layout: how the image is drawn onto the canvas
  const layoutRef = useRef({ offX: 0, offY: 0, scale: 1, natW: 0, natH: 0 })

  // drag state stored in a ref so pointer handlers stay stable
  const dragRef = useRef(null)  // { type: 'move'|handle, startX, startY, startBox }

  // ── Load image ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open || !src) return
    setImgReady(false)
    setBox(null)
    const img = new Image()
    img.onload = () => {
      imgRef.current = img
      setImgReady(true)
    }
    img.src = src
  }, [open, src])

  // ── Layout + initial box ────────────────────────────────────────────────────
  const computeLayout = useCallback(() => {
    const canvas = canvasRef.current
    const img = imgRef.current
    if (!canvas || !img) return

    const maxW = canvas.parentElement?.clientWidth || 600
    const maxH = Math.min(window.innerHeight * 0.55, 480)

    const scaleW = maxW / img.naturalWidth
    const scaleH = maxH / img.naturalHeight
    const scale = Math.min(scaleW, scaleH, 1)

    const dw = Math.round(img.naturalWidth * scale)
    const dh = Math.round(img.naturalHeight * scale)

    canvas.width = dw
    canvas.height = dh

    layoutRef.current = { offX: 0, offY: 0, scale, natW: img.naturalWidth, natH: img.naturalHeight }

    // Initial box: 80% of canvas, centred
    if (!box) {
      const bw = Math.round(dw * 0.8)
      const bh = Math.round(dh * 0.8)
      setBox({ x: Math.round((dw - bw) / 2), y: Math.round((dh - bh) / 2), w: bw, h: bh })
    }
  }, [box])  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (imgReady) computeLayout()
  }, [imgReady, computeLayout])

  // ── Draw ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    const img = imgRef.current
    if (!canvas || !img || !box) return
    const ctx = canvas.getContext('2d')
    const { scale } = layoutRef.current

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, Math.round(img.naturalWidth * scale), Math.round(img.naturalHeight * scale))

    // Dark overlay outside crop
    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Clear (reveal) the crop area
    ctx.clearRect(box.x, box.y, box.w, box.h)
    ctx.drawImage(
      img,
      Math.round(box.x / scale), Math.round(box.y / scale),
      Math.round(box.w / scale), Math.round(box.h / scale),
      box.x, box.y, box.w, box.h,
    )

    // Border
    ctx.strokeStyle = '#ff6b35'
    ctx.lineWidth = 2
    ctx.strokeRect(box.x + 1, box.y + 1, box.w - 2, box.h - 2)

    // Rule-of-thirds grid (subtle)
    ctx.strokeStyle = 'rgba(255,107,53,0.3)'
    ctx.lineWidth = 1
    for (let i = 1; i < 3; i++) {
      const gx = box.x + (box.w * i) / 3
      const gy = box.y + (box.h * i) / 3
      ctx.beginPath(); ctx.moveTo(gx, box.y); ctx.lineTo(gx, box.y + box.h); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(box.x, gy); ctx.lineTo(box.x + box.w, gy); ctx.stroke()
    }

    // Handles
    for (const h of HANDLES) {
      const [hx, hy] = handleCenter(box, h)
      ctx.fillStyle = 'white'
      ctx.strokeStyle = '#ff6b35'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(hx, hy, 6, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
    }
  }, [box])

  // ── Pointer events ──────────────────────────────────────────────────────────
  function canvasPos(e) {
    const rect = canvasRef.current.getBoundingClientRect()
    const scaleX = canvasRef.current.width / rect.width
    const scaleY = canvasRef.current.height / rect.height
    return [(e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY]
  }

  function onPointerDown(e) {
    if (!box) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const [px, py] = canvasPos(e)
    const handle = hitHandle(box, px, py)
    if (handle) {
      dragRef.current = { type: handle, startX: px, startY: py, startBox: { ...box } }
    } else if (insideBox(box, px, py)) {
      dragRef.current = { type: 'move', startX: px, startY: py, startBox: { ...box } }
    }
  }

  function onPointerMove(e) {
    if (!box) return
    const [px, py] = canvasPos(e)
    const canvas = canvasRef.current

    if (!dragRef.current) {
      const handle = hitHandle(box, px, py)
      if (handle) { canvas.style.cursor = getCursor(handle) }
      else if (insideBox(box, px, py)) { canvas.style.cursor = 'move' }
      else { canvas.style.cursor = 'default' }
      return
    }

    const { type, startX, startY, startBox } = dragRef.current
    const dx = px - startX
    const dy = py - startY
    const cw = canvas.width
    const ch = canvas.height

    if (type === 'move') {
      setBox({
        ...startBox,
        x: clamp(startBox.x + dx, 0, cw - startBox.w),
        y: clamp(startBox.y + dy, 0, ch - startBox.h),
      })
    } else {
      setBox(resizeBox(startBox, type, dx, dy, cw, ch))
    }
  }

  function onPointerUp() {
    dragRef.current = null
  }

  // ── Apply crop ───────────────────────────────────────────────────────────────
  function applyCrop() {
    const img = imgRef.current
    if (!img || !box) return
    const { scale } = layoutRef.current

    const sx = Math.round(box.x / scale)
    const sy = Math.round(box.y / scale)
    const sw = Math.round(box.w / scale)
    const sh = Math.round(box.h / scale)

    const out = document.createElement('canvas')
    out.width = sw
    out.height = sh
    out.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh)

    out.toBlob((blob) => {
      const file = new File([blob], 'cropped.jpg', { type: 'image/jpeg' })
      const preview = URL.createObjectURL(blob)
      onCrop(file, preview)
    }, 'image/jpeg', 0.92)
  }

  return (
    <Modal
      open={open}
      title="Обрезать фото"
      onClose={onClose}
      maxWidth={680}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Отмена</button>
          <button className="btn btn-primary" onClick={applyCrop} disabled={!box}>✂ Применить</button>
        </>
      }
    >
      <p className="ocr-hint">Перетащите рамку или тяните за угловые точки, чтобы выбрать область.</p>
      <div className="crop-canvas-wrap">
        <canvas
          ref={canvasRef}
          className="crop-canvas"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        />
        {!imgReady && <div className="crop-loading">Загрузка изображения...</div>}
      </div>
    </Modal>
  )
}
