using UnityEngine;
using System;

namespace Glyphtender.Unity
{
    /// <summary>
    /// Centralized responsive UI scaling system.
    /// Attach to UICamera. Other UI components subscribe to OnLayoutChanged
    /// and use the scaling methods.
    /// </summary>
    public class UIScaler : MonoBehaviour
    {
        public static UIScaler Instance { get; private set; }

        [Header("Camera")]
        public Camera uiCamera;

        [Header("Portrait Settings")]
        [Tooltip("Target width percent in portrait mode")]
        public float portraitWidthPercent = 0.95f;

        [Header("Landscape Settings")]
        [Tooltip("Target width percent at reference aspect")]
        public float landscapeBasePercent = 0.45f;

        [Tooltip("Reference aspect ratio (phone landscape = 2.2)")]
        public float referenceAspect = 2.2f;

        [Header("Text/UI Element Scaling")]
        [Tooltip("Reference ortho size where base scale = 1")]
        public float referenceOrthoSize = 5f;

        // Events
        public event Action OnLayoutChanged;

        // State
        private float _lastAspect;
        private float _lastOrthoSize;
        private bool _lastIsPortrait;

        // Cached values
        public float Aspect => uiCamera != null ? uiCamera.aspect : 1f;
        public float OrthoSize => uiCamera != null ? uiCamera.orthographicSize : 5f;
        public bool IsPortrait => Screen.height > Screen.width;
        public float HalfHeight => OrthoSize;
        public float HalfWidth => OrthoSize * Aspect;

        private void Awake()
        {
            if (Instance == null)
            {
                Instance = this;
            }
            else
            {
                Destroy(this);
                return;
            }
        }

        private void Start()
        {
            if (uiCamera == null)
            {
                uiCamera = GetComponent<Camera>();
            }

            if (uiCamera == null)
            {
                Debug.LogError("UIScaler: No camera found!");
                return;
            }

            _lastAspect = uiCamera.aspect;
            _lastOrthoSize = uiCamera.orthographicSize;
            _lastIsPortrait = IsPortrait;
        }

        private void Update()
        {
            if (uiCamera == null) return;

            bool isPortrait = IsPortrait;
            bool aspectChanged = Mathf.Abs(uiCamera.aspect - _lastAspect) > 0.01f;
            bool sizeChanged = Mathf.Abs(uiCamera.orthographicSize - _lastOrthoSize) > 0.01f;
            bool orientationChanged = isPortrait != _lastIsPortrait;

            if (aspectChanged || sizeChanged || orientationChanged)
            {
                _lastAspect = uiCamera.aspect;
                _lastOrthoSize = uiCamera.orthographicSize;
                _lastIsPortrait = isPortrait;

                OnLayoutChanged?.Invoke();
            }
        }

        /// <summary>
        /// Gets the width percent target based on orientation.
        /// Portrait uses portraitWidthPercent.
        /// Landscape scales down for wider screens.
        /// </summary>
        public float GetTargetWidthPercent()
        {
            if (IsPortrait)
            {
                return portraitWidthPercent;
            }
            else
            {
                float percent = landscapeBasePercent * (referenceAspect / Aspect);
                return Mathf.Clamp(percent, 0.2f, 0.95f);
            }
        }

        /// <summary>
        /// Gets scale factor for a group that should fill a percentage of screen width.
        /// Pass the natural width of the group (unscaled).
        /// </summary>
        public float GetWidthFillScale(float naturalWidth)
        {
            if (uiCamera == null || naturalWidth <= 0) return 1f;

            float camWidth = OrthoSize * Aspect * 2f;
            float targetWidth = camWidth * GetTargetWidthPercent();

            return targetWidth / naturalWidth;
        }

        /// <summary>
        /// Gets scale factor for UI elements (text, buttons) that should maintain
        /// consistent screen proportion regardless of camera ortho size.
        /// </summary>
        public float GetElementScale()
        {
            if (uiCamera == null) return 1f;
            return referenceOrthoSize / OrthoSize;
        }

        /// <summary>
        /// Gets scale factor for UI elements in landscape.
        /// Narrower landscapes (16:9) get larger elements for better touch targets.
        /// Wider landscapes (21:9) get slightly smaller elements.
        /// </summary>
        public float GetLandscapeElementScale()
        {
            if (IsPortrait)
            {
                return 1f;
            }
            else
            {
                // Invert: narrower aspect = larger scale
                float scale = referenceAspect / Aspect;
                return Mathf.Clamp(scale, 0.8f, 2.0f);
            }
        }

        /// <summary>
        /// Convenience: Get position at screen edge with margin.
        /// </summary>
        public float GetRightEdge(float margin = 0f)
        {
            return HalfWidth - margin;
        }

        public float GetLeftEdge(float margin = 0f)
        {
            return -HalfWidth + margin;
        }

        public float GetTopEdge(float margin = 0f)
        {
            return HalfHeight - margin;
        }

        public float GetBottomEdge(float margin = 0f)
        {
            return -HalfHeight + margin;
        }
    }
}