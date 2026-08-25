import { useState, useEffect, useRef } from 'react'
import { encryptPaste, decryptPaste } from './utils/crypto'
import {
  hideDataInImage,
  recoverDataFromImage,
} from './utils/steganography'
import './App.css'
import './index.css'

function App() {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('crypton-theme') || 'dark'
  })

  const [activeMode, setActiveMode] = useState('transfer')
  const [hiddenTab, setHiddenTab] = useState('encode')

  const [inputText, setInputText] = useState('')
  const [createPassword, setCreatePassword] = useState('')
  const [shareableUrl, setShareableUrl] = useState('')
  const [copied, setCopied] = useState(false)

  const [burn, setBurn] = useState(true)
  const [maxViews, setMaxViews] = useState('1')

  const [expireAfter, setExpireAfter] = useState(300)
  const [customExpiryValue, setCustomExpiryValue] = useState('')
  const [customExpiryUnit, setCustomExpiryUnit] =
    useState('minutes')

  const [holdToRevealOption, setHoldToRevealOption] =
    useState(false)

  const [isViewing, setIsViewing] = useState(false)
  const [decryptedText, setDecryptedText] = useState('')
  const [error, setError] = useState('')

  const [needsPassword, setNeedsPassword] = useState(false)
  const [viewPassword, setViewPassword] = useState('')
  const [encryptedPayload, setEncryptedPayload] =
    useState(null)

  const [isBurnAfterReading, setIsBurnAfterReading] =
    useState(false)

  const [requireHoldToReveal, setRequireHoldToReveal] =
    useState(false)

  const [countdown, setCountdown] = useState('')

  const [createdPasteId, setCreatedPasteId] = useState('')
  const [deleteToken, setDeleteToken] = useState('')

  const [image, setImage] = useState(null)
  const [decryptedImage, setDecryptedImage] = useState(null)

  const [isDragging, setIsDragging] = useState(false)
  const [isWindowFocused, setIsWindowFocused] =
    useState(true)

  const [isHoldingToReveal, setIsHoldingToReveal] =
    useState(false)

  const hasConsumedView = useRef(false)

  // Hidden Data / Steganography state

  const [hiddenPayloadType, setHiddenPayloadType] =
    useState('text')

  const [hiddenText, setHiddenText] = useState('')
  const [hiddenFile, setHiddenFile] = useState(null)

  const [carrierImage, setCarrierImage] = useState(null)
  const [carrierImageName, setCarrierImageName] =
    useState('')

  const [carrierCapacity, setCarrierCapacity] =
    useState(null)

  const [hiddenPassword, setHiddenPassword] =
    useState('')

  const [
    hiddenPasswordConfirm,
    setHiddenPasswordConfirm,
  ] = useState('')

  const [
    hiddenDecodeImage,
    setHiddenDecodeImage,
  ] = useState(null)

  const [
    hiddenDecodeImageName,
    setHiddenDecodeImageName,
  ] = useState('')

  const [
    hiddenDecodePassword,
    setHiddenDecodePassword,
  ] = useState('')

  const [hiddenStatus, setHiddenStatus] = useState('')
  const [hiddenError, setHiddenError] = useState('')

  const [hiddenRecoveredData, setHiddenRecoveredData] =
    useState(null)

  const [hiddenGeneratedFile, setHiddenGeneratedFile] =
    useState(null)

  // --------------------------------------------------
  // THEME
  // --------------------------------------------------

  useEffect(() => {
    document.documentElement.setAttribute(
      'data-theme',
      theme
    )

    localStorage.setItem(
      'crypton-theme',
      theme
    )
  }, [theme])

  // --------------------------------------------------
  // LOAD SECURE LINK
  // --------------------------------------------------

  useEffect(() => {
    const urlParams =
      new URLSearchParams(window.location.search)

    const pasteId = urlParams.get('id')

    const hashKey =
      window.location.hash.substring(1)

    if (pasteId && hashKey) {
      setIsViewing(true)

      fetchAndAttemptDecrypt(
        pasteId,
        hashKey
      )
    }
  }, [])

  // --------------------------------------------------
  // COUNTDOWN
  // --------------------------------------------------

  useEffect(() => {
    let interval

    if (
      isViewing &&
      decryptedText &&
      encryptedPayload?.expiresAt &&
      !isBurnAfterReading
    ) {
      const updateTimer = () => {
        const msRemaining =
          encryptedPayload.expiresAt -
          Date.now()

        if (msRemaining <= 0) {
          setDecryptedText('')
          setDecryptedImage(null)
          setCountdown('')

          setError(
            'Time expired. The secure content is no longer available.'
          )

          clearInterval(interval)
          return
        }

        const mins =
          Math.floor(msRemaining / 60000)

        const secs = Math.floor(
          (msRemaining % 60000) / 1000
        )
          .toString()
          .padStart(2, '0')

        setCountdown(`${mins}:${secs}`)
      }

      updateTimer()

      interval = setInterval(
        updateTimer,
        1000
      )
    }

    return () => clearInterval(interval)
  }, [
    isViewing,
    decryptedText,
    encryptedPayload,
    isBurnAfterReading,
  ])

  // --------------------------------------------------
  // TAB SWITCH / FOCUS PROTECTION
  // --------------------------------------------------

  useEffect(() => {
    if (!isViewing) return

    const clearSecureContent = (
      message
    ) => {
      if (
        decryptedText ||
        decryptedImage
      ) {
        setDecryptedText('')
        setDecryptedImage(null)
        setCountdown('')
        setIsHoldingToReveal(false)

        setError(message)
      }
    }

    const handleVisibilityChange = () => {
      if (
        document.hidden ||
        document.visibilityState === 'hidden'
      ) {
        clearSecureContent(
          'Secure content was cleared because the application lost visibility.'
        )

        setIsWindowFocused(false)
      } else {
        setIsWindowFocused(true)
      }
    }

    const handleBlur = () => {
      clearSecureContent(
        'Secure content was cleared because the application lost focus.'
      )

      setIsWindowFocused(false)
      setIsHoldingToReveal(false)
    }

    const handleFocus = () => {
      setIsWindowFocused(true)
    }

    document.addEventListener(
      'visibilitychange',
      handleVisibilityChange
    )

    window.addEventListener(
      'blur',
      handleBlur
    )

    window.addEventListener(
      'focus',
      handleFocus
    )

    return () => {
      document.removeEventListener(
        'visibilitychange',
        handleVisibilityChange
      )

      window.removeEventListener(
        'blur',
        handleBlur
      )

      window.removeEventListener(
        'focus',
        handleFocus
      )
    }
  }, [
    isViewing,
    decryptedText,
    decryptedImage,
  ])

  // --------------------------------------------------
  // KEYBOARD / HOLD PROTECTION
  // --------------------------------------------------

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'PrintScreen') {
        e.preventDefault()
        setIsHoldingToReveal(false)
      }

      if (
        (e.metaKey ||
          e.ctrlKey ||
          e.altKey) &&
        e.shiftKey
      ) {
        setIsHoldingToReveal(false)
      }
    }

    const handleKeyUp = () => {
      setIsHoldingToReveal(false)
    }

    const handleMouseUp = () => {
      setIsHoldingToReveal(false)
    }

    window.addEventListener(
      'keydown',
      handleKeyDown
    )

    window.addEventListener(
      'keyup',
      handleKeyUp
    )

    window.addEventListener(
      'mouseup',
      handleMouseUp
    )

    return () => {
      window.removeEventListener(
        'keydown',
        handleKeyDown
      )

      window.removeEventListener(
        'keyup',
        handleKeyUp
      )

      window.removeEventListener(
        'mouseup',
        handleMouseUp
      )
    }
  }, [])

  // --------------------------------------------------
  // GENERAL HELPERS
  // --------------------------------------------------

  const toggleTheme = () => {
    setTheme((currentTheme) =>
      currentTheme === 'dark'
        ? 'light'
        : 'dark'
    )
  }

  const switchMode = (mode) => {
    setActiveMode(mode)
    setError('')
    setHiddenError('')
    setHiddenStatus('')
  }

  const getEffectiveTtl = () => {
    if (expireAfter === 'custom') {
      const value = Math.max(
        1,
        parseInt(
          customExpiryValue,
          10
        ) || 1
      )

      if (
        customExpiryUnit === 'seconds'
      ) {
        return value
      }

      if (
        customExpiryUnit === 'minutes'
      ) {
        return value * 60
      }

      if (
        customExpiryUnit === 'hours'
      ) {
        return value * 3600
      }

      if (
        customExpiryUnit === 'days'
      ) {
        return value * 86400
      }
    }

    return Number(expireAfter)
  }

  // --------------------------------------------------
  // CREATE PASTE
  // --------------------------------------------------

  const handleCreatePaste = async () => {
    try {
      setError('')

      const effectiveTtlSeconds =
        getEffectiveTtl()

      const secretPayload =
        JSON.stringify({
          text: inputText,
          image,
          holdToReveal:
            holdToRevealOption,
        })

      const {
        ciphertext,
        iv,
        salt,
        keyToShare,
      } = await encryptPaste(
        secretPayload,
        createPassword
      )

      const viewsToSend =
        Math.max(
          1,
          parseInt(
            maxViews,
            10
          ) || 1
        )

      const response =
        await fetch(
          '/api/paste',
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json',
            },

            body: JSON.stringify({
              ciphertext,
              iv,
              salt,

              burnAfterReading:
                burn,

              ttlSeconds:
                effectiveTtlSeconds,

              maxViews:
                viewsToSend,
            }),
          }
        )

      if (!response.ok) {
        const errorData =
          await response
            .json()
            .catch(() => ({}))

        throw new Error(
          errorData.error ||
            'Unable to create secure transfer.'
        )
      }

      const data =
        await response.json()

      const url =
        `${window.location.origin}` +
        `${window.location.pathname}` +
        `?id=${data.id}` +
        `#${keyToShare}`

      setShareableUrl(url)
      setCreatedPasteId(data.id)
      setDeleteToken(data.deleteToken)
      setCopied(false)
    } catch (err) {
      console.error(
        'Crypton create error:',
        err
      )

      setError(
        err.message ||
          'Unable to create the secure link.'
      )
    }
  }

  // --------------------------------------------------
  // COPY LINK
  // --------------------------------------------------

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(
        shareableUrl
      )

      setCopied(true)

      setTimeout(() => {
        setInputText('')
        setCreatePassword('')
        setImage(null)
        setCopied(false)

        setError(
          'Secure content cleared from this workspace. The link remains available until it expires, reaches its access limit, or is terminated.'
        )
      }, 1000)
    } catch {
      setError(
        'Unable to copy the secure link.'
      )
    }
  }

  // --------------------------------------------------
  // FETCH WITHOUT CONSUMING VIEW
  // --------------------------------------------------

  const fetchAndAttemptDecrypt = async (
    id,
    key
  ) => {
    try {
      hasConsumedView.current = false

      const response =
        await fetch(
          `/api/paste/${id}`
        )

      if (!response.ok) {
        const errorData =
          await response
            .json()
            .catch(() => ({}))

        throw new Error(
          errorData.error ||
            'Secure content was not found.'
        )
      }

      const payload =
        await response.json()

      setEncryptedPayload({
        ...payload,
        key,
        id,
      })

      await executeDecryption(
        payload.ciphertext,
        payload.iv,
        payload.salt,
        key,
        '',
        payload.expiresAt,
        payload.burnAfterReading,
        id
      )
    } catch (err) {
      if (
        err.message ===
        'WRONG_PASSWORD'
      ) {
        setNeedsPassword(true)
        setError('')
      } else {
        setError(err.message)
      }
    }
  }

  // --------------------------------------------------
  // PASSWORD SUBMIT
  // --------------------------------------------------

  const handlePasswordSubmit =
    async () => {
      if (!encryptedPayload) return

      try {
        await executeDecryption(
          encryptedPayload.ciphertext,
          encryptedPayload.iv,
          encryptedPayload.salt,
          encryptedPayload.key,
          viewPassword,
          encryptedPayload.expiresAt,
          encryptedPayload.burnAfterReading,
          encryptedPayload.id
        )

        setNeedsPassword(false)
        setError('')
      } catch (err) {
        if (
          err.message ===
          'WRONG_PASSWORD'
        ) {
          setError(
            'Incorrect recovery password.'
          )
        } else {
          setError(
            err.message ||
              'Unable to decrypt secure content.'
          )
        }
      }
    }

  // --------------------------------------------------
  // CONSUME VIEW
  // --------------------------------------------------

  const consumeView = async (
    pasteId
  ) => {
    if (
      hasConsumedView.current
    ) {
      return
    }

    const response =
      await fetch(
        `/api/paste/${pasteId}/consume`,
        {
          method: 'POST',
        }
      )

    if (!response.ok) {
      const errorData =
        await response
          .json()
          .catch(() => ({}))

      throw new Error(
        errorData.error ||
          'Unable to register secure access.'
      )
    }

    hasConsumedView.current = true

    return response.json()
  }

  // --------------------------------------------------
  // DECRYPT THEN CONSUME VIEW
  // --------------------------------------------------

  const executeDecryption = async (
    ciphertext,
    iv,
    salt,
    key,
    password,
    expiresAt,
    isBurn,
    pasteId
  ) => {
    const decryptedString =
      await decryptPaste(
        ciphertext,
        iv,
        salt,
        key,
        password
      )

    try {
      const parsed =
        JSON.parse(
          decryptedString
        )

      setDecryptedText(
        parsed.text || ''
      )

      setDecryptedImage(
        parsed.image || null
      )

      setRequireHoldToReveal(
        parsed.holdToReveal ??
          parsed.macProtection ??
          false
      )
    } catch {
      setDecryptedText(
        decryptedString
      )

      setDecryptedImage(null)

      setRequireHoldToReveal(false)
    }

    setIsBurnAfterReading(isBurn)

    await consumeView(pasteId)

    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}?id=${pasteId}`
    )
  }

  // --------------------------------------------------
  // FORCE DELETE
  // --------------------------------------------------

  const handleForceDelete =
    async () => {
      try {
        const response =
          await fetch(
            `/api/paste/${createdPasteId}`,
            {
              method: 'DELETE',

              headers: {
                'Content-Type':
                  'application/json',
              },

              body: JSON.stringify({
                deleteToken,
              }),
            }
          )

        if (response.ok) {
          setShareableUrl('')
          setCreatedPasteId('')
          setDeleteToken('')

          setError(
            'The secure record has been permanently deleted. The shared link is no longer active.'
          )
        } else {
          setError(
            'The secure record could not be deleted.'
          )
        }
      } catch {
        setError(
          'Unable to communicate with the Crypton server.'
        )
      }
    }

  // --------------------------------------------------
  // IMAGE PROCESSING
  // --------------------------------------------------

  const processImage = (file) => {
    if (!file) return

    if (
      !file.type.startsWith(
        'image/'
      )
    ) {
      setError(
        'Select a valid image file.'
      )
      return
    }

    if (
      file.size >
      2 * 1024 * 1024
    ) {
      setError(
        'The selected image exceeds the current 2 MB secure payload limit.'
      )

      return
    }

    setError('')

    const reader =
      new FileReader()

    reader.onload = (e) => {
      setImage(e.target.result)
    }

    reader.onerror = () => {
      setError(
        'The selected file could not be read.'
      )
    }

    reader.readAsDataURL(file)
  }

  const handleClipboardPaste = (
    e
  ) => {
    let caughtImage = false

    const files =
      e.clipboardData?.files

    if (
      files &&
      files.length > 0
    ) {
      for (
        let i = 0;
        i < files.length;
        i++
      ) {
        if (
          files[i].type.startsWith(
            'image/'
          )
        ) {
          processImage(files[i])
          caughtImage = true
        }
      }
    }

    if (!caughtImage) {
      const items =
        e.clipboardData?.items

      if (items) {
        for (
          let i = 0;
          i < items.length;
          i++
        ) {
          if (
            items[i].type.startsWith(
              'image/'
            )
          ) {
            const file =
              items[i].getAsFile()

            processImage(file)

            caughtImage = true
          }
        }
      }
    }

    if (caughtImage) {
      e.preventDefault()
    }
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)

    if (
      e.dataTransfer.files &&
      e.dataTransfer.files.length > 0
    ) {
      processImage(
        e.dataTransfer.files[0]
      )

      e.dataTransfer.clearData()
    }
  }

  // --------------------------------------------------
  // HOLD TO REVEAL
  // --------------------------------------------------

  const startHolding = () => {
    if (
      requireHoldToReveal
    ) {
      setIsHoldingToReveal(true)
    }
  }

  const stopHolding = () => {
    if (
      requireHoldToReveal
    ) {
      setIsHoldingToReveal(false)
    }
  }

  // --------------------------------------------------
  // HIDDEN DATA UI
  // --------------------------------------------------

  const handleCarrierImage = (
    file
  ) => {
    if (!file) return

    const validTypes = [
      'image/png',
      'image/jpeg',
    ]

    if (
      !validTypes.includes(
        file.type
      )
    ) {
      setHiddenError(
        'Select a PNG, JPG, or JPEG carrier image.'
      )

      return
    }

    setHiddenError('')
    setCarrierImage(file)
    setCarrierImageName(
      file.name
    )

    const imageElement =
      new Image()

    const objectUrl =
      URL.createObjectURL(file)

    imageElement.onload = () => {
      const estimatedBytes =
        Math.floor(
          (
            imageElement.width *
            imageElement.height *
            3
          ) / 8
        )

      setCarrierCapacity({
        width:
          imageElement.width,

        height:
          imageElement.height,

        bytes:
          estimatedBytes,
      })

      URL.revokeObjectURL(
        objectUrl
      )
    }

    imageElement.onerror = () => {
      setHiddenError(
        'The carrier image could not be processed.'
      )

      URL.revokeObjectURL(
        objectUrl
      )
    }

    imageElement.src =
      objectUrl
  }

  const handleHiddenFile = (
    file
  ) => {
    if (!file) return

    const maxFileSize =
      500 * 1024

    if (
      file.size >
      maxFileSize
    ) {
      setHiddenError(
        'The hidden file exceeds the current 500 KB limit.'
      )

      return
    }

    setHiddenError('')
    setHiddenFile(file)
  }

  const handleHiddenDecodeImage =
    (file) => {
      if (!file) return

      const validTypes = [
        'image/png',
        'image/jpeg',
      ]

      if (
        !validTypes.includes(
          file.type
        )
      ) {
        setHiddenError(
          'Select a valid Crypton hidden PNG image.'
        )

        return
      }

      setHiddenError('')
      setHiddenDecodeImage(
        file
      )

      setHiddenDecodeImageName(
        file.name
      )
    }

  const handleGenerateHiddenImage =
    async () => {
      setHiddenError('')
      setHiddenStatus('')

      if (!carrierImage) {
        setHiddenError(
          'Select a carrier image before generating the hidden image.'
        )

        return
      }

      if (
        hiddenPayloadType ===
          'text' &&
        !hiddenText.trim()
      ) {
        setHiddenError(
          'Enter the text that should be protected and hidden.'
        )

        return
      }

      if (
        hiddenPayloadType ===
          'file' &&
        !hiddenFile
      ) {
        setHiddenError(
          'Select the file that should be encrypted and hidden.'
        )

        return
      }

      if (!hiddenPassword) {
        setHiddenError(
          'Create a recovery password for the hidden payload.'
        )

        return
      }

      if (
        hiddenPassword !==
        hiddenPasswordConfirm
      ) {
        setHiddenError(
          'The recovery passwords do not match.'
        )

        return
      }

      try {
        const result =
          await hideDataInImage({
            carrierFile:
              carrierImage,
            payloadType:
              hiddenPayloadType,
            text:
              hiddenText,
            file:
              hiddenFile,
            password:
              hiddenPassword,
          })

        if (hiddenGeneratedFile?.url) {
          URL.revokeObjectURL(
            hiddenGeneratedFile.url
          )
        }

        const downloadUrl =
          URL.createObjectURL(
            result.blob
          )

        setHiddenGeneratedFile({
          url:
            downloadUrl,
          fileName:
            result.fileName,
        })

        setHiddenStatus(
          `Hidden image generated successfully. ${(
            result.payloadSize / 1024
          ).toFixed(1)} KB of encrypted payload embedded into a ${result.width} × ${result.height} PNG.`
        )
      } catch (err) {
        setHiddenError(
          err.message ||
            'Unable to encrypt and embed the hidden payload.'
        )
      }
    }

  const handleRecoverHiddenData =
    async () => {
      setHiddenError('')
      setHiddenStatus('')
      setHiddenRecoveredData(null)

      if (
        !hiddenDecodeImage
      ) {
        setHiddenError(
          'Upload the Crypton hidden image first.'
        )

        return
      }

      if (
        !hiddenDecodePassword
      ) {
        setHiddenError(
          'Enter the recovery password.'
        )

        return
      }

      try {
        const recovered =
          await recoverDataFromImage({
            imageFile:
              hiddenDecodeImage,
            password:
              hiddenDecodePassword,
          })

        setHiddenRecoveredData(
          recovered
        )

        if (
          recovered.type ===
          'text'
        ) {
          setHiddenStatus(
            'Hidden text recovered successfully.'
          )
        } else {
          if (hiddenGeneratedFile?.url) {
            URL.revokeObjectURL(
              hiddenGeneratedFile.url
            )
          }

          const blob =
            new Blob(
              [recovered.data],
              {
                type:
                  recovered.mimeType,
              }
            )

          const url =
            URL.createObjectURL(
              blob
            )

          setHiddenGeneratedFile({
            url,
            fileName:
              recovered.fileName,
          })

          setHiddenStatus(
            `Hidden file recovered successfully: ${recovered.fileName}`
          )
        }
      } catch (err) {
        setHiddenError(
          err.message ||
            'Unable to extract and decrypt the hidden payload.'
        )
      }
    }

  // --------------------------------------------------
  // UI
  // --------------------------------------------------

  return (
    <div className="crypton-shell">
      <header className="topbar">
        <a
          className="brand"
          href="/"
        >
          <div className="brand-mark">
            <span>C</span>
          </div>

          <div>
            <div className="brand-name">
              CRYPTON
            </div>

            <div className="brand-subtitle">
              SECURE DATA INFRASTRUCTURE
            </div>
          </div>
        </a>

        <div className="topbar-actions">
          <div className="system-status">
            <span className="status-dot" />
            Encryption engine active
          </div>

          <button
            className="theme-toggle"
            onClick={toggleTheme}
            type="button"
          >
            <span className="theme-toggle-label">
              {theme === 'dark'
                ? 'Switch to light'
                : 'Switch to dark'}
            </span>

            <span className="theme-toggle-track">
              <span
                className={`theme-toggle-thumb ${
                  theme === 'light'
                    ? 'light'
                    : ''
                }`}
              />
            </span>
          </button>
        </div>
      </header>

      <main className="crypton-main">
        {error && (
          <div className="system-alert system-alert-warning">
            <span className="alert-label">
              SYSTEM NOTICE
            </span>

            <span>{error}</span>

            <button
              type="button"
              className="alert-close"
              onClick={() =>
                setError('')
              }
            >
              Dismiss
            </button>
          </div>
        )}

        {isViewing ? (
          <section className="view-layout">
            <div className="page-heading">
              <div>
                <div className="eyebrow">
                  CRYPTON / SECURE RECOVERY
                </div>

                <h1>
                  Protected content access
                </h1>

                <p>
                  Verify authorization and recover
                  the encrypted content through the
                  Crypton security layer.
                </p>
              </div>

              <div className="security-badge">
                AES-256-GCM
              </div>
            </div>

            {needsPassword ? (
              <div className="security-card recovery-card">
                <div className="card-header">
                  <div>
                    <div className="card-kicker">
                      AUTHORIZATION REQUIRED
                    </div>

                    <h2>
                      Password verification
                    </h2>
                  </div>

                  <span className="card-status">
                    LOCKED
                  </span>
                </div>

                <label className="field">
                  <span>
                    Recovery password
                  </span>

                  <input
                    type="password"
                    placeholder="Enter recovery password"
                    value={viewPassword}
                    onChange={(e) =>
                      setViewPassword(
                        e.target.value
                      )
                    }
                    onKeyDown={(e) => {
                      if (
                        e.key ===
                        'Enter'
                      ) {
                        handlePasswordSubmit()
                      }
                    }}
                  />
                </label>

                <button
                  className="primary-button"
                  type="button"
                  onClick={
                    handlePasswordSubmit
                  }
                >
                  Verify and decrypt
                </button>
              </div>
            ) : (
              <div className="security-card recovery-card">
                <div className="card-header">
                  <div>
                    <div className="card-kicker">
                      SECURE PAYLOAD
                    </div>

                    <h2>
                      Recovered content
                    </h2>
                  </div>

                  <span className="card-status">
                    VERIFIED
                  </span>
                </div>

                {countdown && (
                  <div className="countdown">
                    Expires in {countdown}
                  </div>
                )}

                <div
                  className={`recovered-content ${
                    requireHoldToReveal &&
                    !isHoldingToReveal
                      ? 'concealed'
                      : ''
                  }`}
                  onMouseDown={
                    startHolding
                  }
                  onMouseUp={
                    stopHolding
                  }
                  onMouseLeave={
                    stopHolding
                  }
                  onTouchStart={
                    startHolding
                  }
                  onTouchEnd={
                    stopHolding
                  }
                >
                  {decryptedImage && (
                    <img
                      src={decryptedImage}
                      alt="Recovered secure content"
                      className="recovered-image"
                    />
                  )}

                  {decryptedText}
                </div>

                <div className="card-actions">
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => {
                      window.location.href =
                        '/'
                    }}
                  >
                    New secure transfer
                  </button>

                  {(decryptedText ||
                    decryptedImage) && (
                    <button
                      className="danger-button"
                      type="button"
                      onClick={() => {
                        setDecryptedText('')
                        setDecryptedImage(null)
                        setCountdown('')

                        setError(
                          'Recovered content has been cleared from this screen.'
                        )
                      }}
                    >
                      Clear from screen
                    </button>
                  )}
                </div>
              </div>
            )}
          </section>
        ) : (
          <section className="workspace">
            <div className="workspace-intro">
              <div className="eyebrow">
                CRYPTON /{' '}
                {activeMode ===
                'transfer'
                  ? 'PROTECTED TRANSFER'
                  : 'ADVANCED CONCEALMENT'}
              </div>

              <h1>
                {activeMode ===
                'transfer'
                  ? 'Secure information before it leaves your device.'
                  : 'Encrypt it. Conceal it. Recover it only with authorization.'}
              </h1>

              <p>
                {activeMode ===
                'transfer'
                  ? 'Encrypt sensitive text or image data, control its lifetime, restrict access, and retain the ability to terminate the transfer.'
                  : 'Crypton Hidden Data encrypts confidential text or small files before embedding the protected payload inside an ordinary carrier image.'}
              </p>
            </div>

            <div className="mode-strip">
              <button
                type="button"
                className={`mode-card ${
                  activeMode ===
                  'transfer'
                    ? 'active'
                    : ''
                }`}
                onClick={() =>
                  switchMode(
                    'transfer'
                  )
                }
              >
                <span className="mode-index">
                  01
                </span>

                <div>
                  <strong>
                    Secure Transfer
                  </strong>

                  <p>
                    Encrypt content and generate a
                    controlled access link.
                  </p>
                </div>

                <span className="mode-state">
                  {activeMode ===
                  'transfer'
                    ? 'ACTIVE'
                    : 'SELECT'}
                </span>
              </button>

              <button
                type="button"
                className={`mode-card ${
                  activeMode ===
                  'hidden'
                    ? 'active'
                    : ''
                }`}
                onClick={() =>
                  switchMode('hidden')
                }
              >
                <span className="mode-index">
                  02
                </span>

                <div>
                  <strong>
                    Hidden Data
                  </strong>

                  <p>
                    Encrypt and conceal text or
                    small files inside an image.
                  </p>
                </div>

                <span className="mode-state">
                  {activeMode ===
                  'hidden'
                    ? 'ACTIVE'
                    : 'SELECT'}
                </span>
              </button>
            </div>

            {activeMode ===
            'transfer' ? (
              <div className="workspace-grid">
                <div className="security-card composer-card">
                  <div className="card-header">
                    <div>
                      <div className="card-kicker">
                        PAYLOAD CONFIGURATION
                      </div>

                      <h2>
                        Create secure transfer
                      </h2>
                    </div>

                    <span className="card-status">
                      ENCRYPT BEFORE STORAGE
                    </span>
                  </div>

                  <div
                    className={`drop-zone ${
                      isDragging
                        ? 'dragging'
                        : ''
                    }`}
                    onDragOver={
                      handleDragOver
                    }
                    onDragLeave={
                      handleDragLeave
                    }
                    onDrop={handleDrop}
                  >
                    <textarea
                      rows="9"
                      placeholder="Enter confidential text here. You can also paste or attach an image payload."
                      value={inputText}
                      onChange={(e) =>
                        setInputText(
                          e.target.value
                        )
                      }
                      onPaste={
                        handleClipboardPaste
                      }
                    />

                    <div className="drop-zone-footer">
                      <span>
                        TEXT INPUT / IMAGE PAYLOAD
                      </span>

                      <label className="file-button">
                        Attach image

                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) =>
                            processImage(
                              e.target
                                .files[0]
                            )
                          }
                        />
                      </label>
                    </div>
                  </div>

                  {image && (
                    <div className="image-preview-panel">
                      <div className="preview-header">
                        <span>
                          ATTACHED IMAGE PAYLOAD
                        </span>

                        <button
                          type="button"
                          onClick={() =>
                            setImage(null)
                          }
                        >
                          Remove
                        </button>
                      </div>

                      <img
                        src={image}
                        alt="Attached payload preview"
                      />
                    </div>
                  )}

                  <label className="field">
                    <span>
                      Additional password

                      <small>
                        Optional second layer of
                        authorization
                      </small>
                    </span>

                    <input
                      type="password"
                      placeholder="Leave blank to use link-based recovery only"
                      value={
                        createPassword
                      }
                      onChange={(e) =>
                        setCreatePassword(
                          e.target.value
                        )
                      }
                    />
                  </label>

                  <div className="form-grid">
                    <label className="field">
                      <span>
                        Expiration
                      </span>

                      <select
                        value={
                          expireAfter
                        }
                        onChange={(e) =>
                          setExpireAfter(
                            e.target.value ===
                              'custom'
                              ? 'custom'
                              : Number(
                                  e.target
                                    .value
                                )
                          )
                        }
                      >
                        <option value={120}>
                          2 minutes
                        </option>

                        <option value={180}>
                          3 minutes
                        </option>

                        <option value={300}>
                          5 minutes
                        </option>

                        <option value={3600}>
                          1 hour
                        </option>

                        <option value={86400}>
                          24 hours
                        </option>

                        <option value="custom">
                          Custom duration
                        </option>
                      </select>
                    </label>

                    <label className="field">
                      <span>
                        Maximum views
                      </span>

                      <input
                        type="text"
                        inputMode="numeric"
                        value={maxViews}
                        onChange={(e) =>
                          setMaxViews(
                            e.target.value.replace(
                              /\D/g,
                              ''
                            )
                          )
                        }
                      />
                    </label>
                  </div>

                  {expireAfter ===
                    'custom' && (
                    <div className="custom-expiry">
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="Duration"
                        value={
                          customExpiryValue
                        }
                        onChange={(e) =>
                          setCustomExpiryValue(
                            e.target.value.replace(
                              /\D/g,
                              ''
                            )
                          )
                        }
                      />

                      <select
                        value={
                          customExpiryUnit
                        }
                        onChange={(e) =>
                          setCustomExpiryUnit(
                            e.target.value
                          )
                        }
                      >
                        <option value="seconds">
                          Seconds
                        </option>

                        <option value="minutes">
                          Minutes
                        </option>

                        <option value="hours">
                          Hours
                        </option>

                        <option value="days">
                          Days
                        </option>
                      </select>
                    </div>
                  )}

                  <div className="protection-options">
                    <label className="option-row">
                      <input
                        type="checkbox"
                        checked={burn}
                        onChange={(e) =>
                          setBurn(
                            e.target.checked
                          )
                        }
                      />

                      <span>
                        <strong>
                          Burn after reading
                        </strong>

                        <small>
                          Clear persistent server
                          storage after the final
                          configured view is used.
                        </small>
                      </span>
                    </label>

                    <label className="option-row">
                      <input
                        type="checkbox"
                        checked={
                          holdToRevealOption
                        }
                        onChange={(e) =>
                          setHoldToRevealOption(
                            e.target.checked
                          )
                        }
                      />

                      <span>
                        <strong>
                          Hold-to-reveal protection
                        </strong>

                        <small>
                          Conceal recovered content
                          until the recipient
                          actively holds the reveal
                          area.
                        </small>
                      </span>
                    </label>
                  </div>

                  <button
                    className="primary-button create-button"
                    type="button"
                    onClick={
                      handleCreatePaste
                    }
                    disabled={
                      !inputText && !image
                    }
                  >
                    Encrypt and generate secure link
                  </button>

                  {shareableUrl && (
                    <div className="share-panel">
                      <div className="share-panel-header">
                        <div>
                          <span className="card-kicker">
                            TRANSFER READY
                          </span>

                          <strong>
                            Secure link generated
                          </strong>
                        </div>

                        <span className="card-status">
                          ACTIVE
                        </span>
                      </div>

                      <div className="share-url">
                        <input
                          type="text"
                          readOnly
                          value={
                            shareableUrl
                          }
                          onClick={(e) =>
                            e.target.select()
                          }
                        />

                        <button
                          type="button"
                          className="secondary-button"
                          onClick={
                            handleCopyUrl
                          }
                        >
                          {copied
                            ? 'Copied'
                            : 'Copy link'}
                        </button>
                      </div>

                      <div className="share-actions">
                        <button
                          className="danger-button"
                          type="button"
                          onClick={
                            handleForceDelete
                          }
                        >
                          Terminate transfer
                        </button>

                        <span>
                          You retain control of
                          this transfer while the
                          termination token remains
                          available in this session.
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <aside className="security-sidebar">
                  <div className="security-card protection-summary">
                    <div className="card-kicker">
                      PROTECTION STACK
                    </div>

                    <h2>
                      Current security model
                    </h2>

                    <div className="security-stack">
                      <div className="stack-item">
                        <span>
                          01
                        </span>

                        <div>
                          <strong>
                            Client-side encryption
                          </strong>

                          <p>
                            Payload data is encrypted
                            before being sent to the
                            storage service.
                          </p>
                        </div>
                      </div>

                      <div className="stack-item">
                        <span>
                          02
                        </span>

                        <div>
                          <strong>
                            Independent recovery
                            material
                          </strong>

                          <p>
                            The cryptographic
                            recovery component
                            remains separated from
                            the stored encrypted
                            payload.
                          </p>
                        </div>
                      </div>

                      <div className="stack-item">
                        <span>
                          03
                        </span>

                        <div>
                          <strong>
                            Access lifecycle
                            controls
                          </strong>

                          <p>
                            Configure expiration,
                            view limits, and
                            server-side removal.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </aside>
              </div>
            ) : (
              <section className="hidden-data-workspace">
                <div className="hidden-tabs">
                  <button
                    type="button"
                    className={
                      hiddenTab ===
                      'encode'
                        ? 'hidden-tab active'
                        : 'hidden-tab'
                    }
                    onClick={() => {
                      setHiddenTab('encode')
                      setHiddenError('')
                      setHiddenStatus('')
                      setHiddenRecoveredData(null)
                      setHiddenGeneratedFile(null)
                    }}
                  >
                    <span>
                      01
                    </span>

                    Encode hidden data
                  </button>

                  <button
                    type="button"
                    className={
                      hiddenTab ===
                      'decode'
                        ? 'hidden-tab active'
                        : 'hidden-tab'
                    }
                    onClick={() => {
                      setHiddenTab('decode')
                      setHiddenError('')
                      setHiddenStatus('')
                      setHiddenRecoveredData(null)
                      setHiddenGeneratedFile(null)
                    }}
                  >
                    <span>
                      02
                    </span>

                    Decode hidden data
                  </button>
                </div>

                {hiddenError && (
                  <div className="system-alert system-alert-warning">
                    <span className="alert-label">
                      HIDDEN DATA
                    </span>

                    <span>
                      {hiddenError}
                    </span>

                    <button
                      type="button"
                      className="alert-close"
                      onClick={() =>
                        setHiddenError('')
                      }
                    >
                      Dismiss
                    </button>
                  </div>
                )}

                {hiddenStatus && (
                  <div className="system-alert">
                    <span className="alert-label">
                      STATUS
                    </span>

                    <span>
                      {hiddenStatus}
                    </span>
                  </div>
                )}

                {hiddenTab ===
                'encode' ? (
                  <div className="hidden-encode-layout">
                    <div className="security-card hidden-main-card">
                      <div className="card-header">
                        <div>
                          <div className="card-kicker">
                            SECURE EMBEDDING
                          </div>

                          <h2>
                            Hide data inside image
                          </h2>
                        </div>

                        <span className="card-status">
                          LOCAL PROCESSING
                        </span>
                      </div>

                      <div className="hidden-payload-selector">
                        <button
                          type="button"
                          className={
                            hiddenPayloadType ===
                            'text'
                              ? 'hidden-payload-option active'
                              : 'hidden-payload-option'
                          }
                          onClick={() => {
                            setHiddenPayloadType(
                              'text'
                            )
                            setHiddenError('')
                            setHiddenStatus('')
                          }}
                        >
                          <strong>
                            Text payload
                          </strong>

                          <span>
                            Hide confidential text
                            inside the carrier.
                          </span>
                        </button>

                        <button
                          type="button"
                          className={
                            hiddenPayloadType ===
                            'file'
                              ? 'hidden-payload-option active'
                              : 'hidden-payload-option'
                          }
                          onClick={() => {
                            setHiddenPayloadType(
                              'file'
                            )
                            setHiddenError('')
                            setHiddenStatus('')
                          }}
                        >
                          <strong>
                            File payload
                          </strong>

                          <span>
                            Hide a small encrypted
                            file inside the carrier.
                          </span>
                        </button>
                      </div>

                      {hiddenPayloadType ===
                      'text' ? (
                        <label className="field">
                          <span>
                            Confidential text
                          </span>

                          <textarea
                            rows="8"
                            placeholder="Enter the text you want to encrypt and conceal..."
                            value={
                              hiddenText
                            }
                            onChange={(e) =>
                              setHiddenText(
                                e.target.value
                              )
                            }
                          />
                        </label>
                      ) : (
                        <label className="carrier-upload">
                          <input
                            type="file"
                            onChange={(e) =>
                              handleHiddenFile(
                                e.target
                                  .files[0]
                              )
                            }
                          />

                          {hiddenFile ? (
                            <div className="carrier-selected">
                              <strong>
                                {
                                  hiddenFile.name
                                }
                              </strong>

                              <span>
                                {(
                                  hiddenFile.size /
                                  1024
                                ).toFixed(1)}
                                {' KB'}
                              </span>
                            </div>
                          ) : (
                            <div>
                              <strong>
                                Upload file to hide
                              </strong>

                              <span>
                                Maximum protected
                                file size: 500 KB.
                              </span>
                            </div>
                          )}
                        </label>
                      )}

                      <div className="hidden-divider" />

                      <div className="card-header">
                        <div>
                          <div className="card-kicker">
                            CARRIER IMAGE
                          </div>

                          <h3>
                            Select image for
                            embedding
                          </h3>
                        </div>

                        <span>
                          PNG / JPG / JPEG
                        </span>
                      </div>

                      <label className="carrier-upload">
                        <input
                          type="file"
                          accept="image/png,image/jpeg"
                          onChange={(e) =>
                            handleCarrierImage(
                              e.target
                                .files[0]
                            )
                          }
                        />

                        {carrierImage ? (
                          <div className="carrier-selected">
                            <strong>
                              {
                                carrierImageName
                              }
                            </strong>

                            {carrierCapacity && (
                              <span>
                                {
                                  carrierCapacity.width
                                }
                                {' × '}
                                {
                                  carrierCapacity.height
                                }
                                {' pixels'}
                              </span>
                            )}
                          </div>
                        ) : (
                          <div>
                            <strong>
                              Upload carrier image
                            </strong>

                            <span>
                              JPEG carriers are
                              converted internally
                              and Crypton always
                              produces a PNG.
                            </span>
                          </div>
                        )}
                      </label>

                      {carrierCapacity && (
                        <div className="capacity-panel">
                          <div>
                            <span>
                              ESTIMATED RAW
                              CAPACITY
                            </span>

                            <strong>
                              ~
                              {(
                                carrierCapacity.bytes /
                                1024
                              ).toFixed(1)}
                              {' KB'}
                            </strong>
                          </div>

                          <p>
                            Final usable capacity
                            will be lower because
                            Crypton stores
                            encryption, metadata,
                            and payload framing
                            information.
                          </p>
                        </div>
                      )}

                      <div className="hidden-divider" />

                      <div className="hidden-password-grid">
                        <label className="field">
                          <span>
                            Recovery password

                            <small>
                              Required to decrypt the
                              hidden payload.
                            </small>
                          </span>

                          <input
                            type="password"
                            placeholder="Create recovery password"
                            value={
                              hiddenPassword
                            }
                            onChange={(e) =>
                              setHiddenPassword(
                                e.target.value
                              )
                            }
                          />
                        </label>

                        <label className="field">
                          <span>
                            Confirm password
                          </span>

                          <input
                            type="password"
                            placeholder="Confirm recovery password"
                            value={
                              hiddenPasswordConfirm
                            }
                            onChange={(e) =>
                              setHiddenPasswordConfirm(
                                e.target.value
                              )
                            }
                          />
                        </label>
                      </div>

                      <button
                        type="button"
                        className="primary-button create-button"
                        onClick={
                          handleGenerateHiddenImage
                        }
                      >
                        Encrypt and generate hidden
                        image
                      </button>

                      {hiddenGeneratedFile && (
  <div className="share-panel hidden-generated-panel">
    <div className="share-panel-header">
      <div>
        <span className="card-kicker">
          HIDDEN DATA READY
        </span>

        <strong>
          {hiddenGeneratedFile.fileName}
        </strong>
      </div>

      <span className="card-status">
        COMPLETE
      </span>
    </div>

    <div className="hidden-generated-actions">
      <a
        className="primary-button hidden-download-button"
        href={hiddenGeneratedFile.url}
        download={hiddenGeneratedFile.fileName}
      >
        Download hidden image
      </a>
    </div>
  </div>
)}
                    </div>

                    <aside className="security-sidebar">
                      <div className="security-card hidden-info-card">
                        <div className="card-kicker">
                          CONCEALMENT PIPELINE
                        </div>

                        <h2>
                          How Crypton Hidden Data
                          works
                        </h2>

                        <div className="pipeline-list">
                          <div className="pipeline-item">
                            <span>
                              01
                            </span>

                            <div>
                              <strong>
                                Package
                              </strong>

                              <p>
                                Text or file data is
                                combined with
                                essential recovery
                                metadata.
                              </p>
                            </div>
                          </div>

                          <div className="pipeline-item">
                            <span>
                              02
                            </span>

                            <div>
                              <strong>
                                Encrypt
                              </strong>

                              <p>
                                The complete payload
                                is encrypted using
                                the recovery password.
                              </p>
                            </div>
                          </div>

                          <div className="pipeline-item">
                            <span>
                              03
                            </span>

                            <div>
                              <strong>
                                Embed
                              </strong>

                              <p>
                                The encrypted bytes
                                are stored inside
                                lossless image pixel
                                data.
                              </p>
                            </div>
                          </div>

                          <div className="pipeline-item">
                            <span>
                              04
                            </span>

                            <div>
                              <strong>
                                Recover
                              </strong>

                              <p>
                                Crypton extracts and
                                decrypts the payload
                                only when the correct
                                recovery password is
                                supplied.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </aside>
                  </div>
                ) : (
                  <div className="hidden-decode-layout">
                    <div className="security-card hidden-main-card">
                      <div className="card-header">
                        <div>
                          <div className="card-kicker">
                            EXTRACT AND RECOVER
                          </div>

                          <h2>
                            Recover hidden payload
                          </h2>
                        </div>

                        <span className="card-status">
                          AUTHORIZATION REQUIRED
                        </span>
                      </div>

                      <p className="card-description">
                        Upload an image generated by
                        Crypton Hidden Data and
                        provide the recovery password
                        used when the payload was
                        created.
                      </p>

                      <label className="decode-upload">
                        <input
                          type="file"
                          accept="image/png,image/jpeg"
                          onChange={(e) =>
                            handleHiddenDecodeImage(
                              e.target
                                .files[0]
                            )
                          }
                        />

                        {hiddenDecodeImage ? (
                          <div>
                            <div className="card-kicker">
                              HIDDEN IMAGE SELECTED
                            </div>

                            <strong>
                              {
                                hiddenDecodeImageName
                              }
                            </strong>

                            <span>
                              Ready for extraction
                              and verification.
                            </span>
                          </div>
                        ) : (
                          <div>
                            <div className="card-kicker">
                              INPUT REQUIRED
                            </div>

                            <strong>
                              Upload hidden image
                            </strong>

                            <span>
                              Select the
                              Crypton-generated PNG
                              that contains the
                              encrypted payload.
                            </span>
                          </div>
                        )}
                      </label>

                      <label className="field">
                        <span>
                          Recovery password

                          <small>
                            The password decrypts the
                            extracted payload after
                            recovery.
                          </small>
                        </span>

                        <input
                          type="password"
                          placeholder="Enter recovery password"
                          value={
                            hiddenDecodePassword
                          }
                          onChange={(e) =>
                            setHiddenDecodePassword(
                              e.target.value
                            )
                          }
                          onKeyDown={(e) => {
                            if (
                              e.key ===
                              'Enter'
                            ) {
                              handleRecoverHiddenData()
                            }
                          }}
                        />
                      </label>

                      <button
                        type="button"
                        className="primary-button create-button"
                        onClick={
                          handleRecoverHiddenData
                        }
                      >
                        Extract and decrypt hidden
                        data
                      </button>

                      {hiddenRecoveredData?.type ===
                        'text' && (
                        <div className="share-panel">
                          <div className="share-panel-header">
                            <div>
                              <span className="card-kicker">
                                RECOVERED TEXT
                              </span>

                              <strong>
                                Hidden payload
                                decrypted
                              </strong>
                            </div>

                            <span className="card-status">
                              VERIFIED
                            </span>
                          </div>

                          <div className="recovered-text">
  {hiddenRecoveredData.text}
</div>

                          <div className="share-actions">
                            <button
                              type="button"
                              className="secondary-button"
                              onClick={async () => {
                                try {
                                  await navigator.clipboard.writeText(
                                    hiddenRecoveredData.text
                                  )

                                  setHiddenStatus(
                                    'Recovered text copied to the clipboard.'
                                  )
                                } catch {
                                  setHiddenError(
                                    'Unable to copy recovered text to the clipboard.'
                                  )
                                }
                              }}
                            >
                              Copy recovered text
                            </button>
                          </div>
                        </div>
                      )}

                      {hiddenRecoveredData?.type ===
                        'file' &&
                        hiddenGeneratedFile && (
                          <div className="share-panel">
                            <div className="share-panel-header">
                              <div>
                                <span className="card-kicker">
                                  RECOVERED FILE
                                </span>

                                <strong>
                                  {
                                    hiddenRecoveredData.fileName
                                  }
                                </strong>
                              </div>

                              <span className="card-status">
                                VERIFIED
                              </span>
                            </div>

                            <div className="share-actions">
                              <a
                                className="primary-button"
                                href={
                                  hiddenGeneratedFile.url
                                }
                                download={
                                  hiddenGeneratedFile.fileName
                                }
                              >
                                Download recovered file
                              </a>
                            </div>
                          </div>
                        )}
                    </div>

                    <div className="security-card decode-security-note">
                      <div className="card-kicker">
                        RECOVERY MODEL
                      </div>

                      <h2>
                        Two independent layers
                      </h2>

                      <div className="decode-layer">
                        <span>
                          01
                        </span>

                        <div>
                          <strong>
                            Steganographic extraction
                          </strong>

                          <p>
                            Crypton first identifies
                            and extracts the concealed
                            encrypted byte sequence.
                          </p>
                        </div>
                      </div>

                      <div className="decode-layer">
                        <span>
                          02
                        </span>

                        <div>
                          <strong>
                            Cryptographic recovery
                          </strong>

                          <p>
                            The extracted data
                            remains unreadable until
                            the correct recovery
                            password decrypts it.
                          </p>
                        </div>
                      </div>

                      <div className="recovery-warning">
                        A valid image alone is not
                        sufficient to reveal the
                        protected content.
                      </div>
                    </div>
                  </div>
                )}
              </section>
            )}
          </section>
        )}
      </main>

      <footer className="crypton-footer">
        <span>
          CRYPTON SECURITY LAYER
        </span>

        <span>
          Encrypted transfer · controlled access ·
          hidden data concealment
        </span>
      </footer>
    </div>
  )
}

export default App