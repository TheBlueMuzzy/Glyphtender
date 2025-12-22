using UnityEngine;

namespace Glyphtender.Unity
{
    /// <summary>
    /// Controls camera positioning, zoom, and panning.
    /// Supports pinch-zoom and bounded panning for mobile.
    /// </summary>
    public class CameraController : MonoBehaviour
    {
        [Header("Board Bounds")]
        public Vector2 boardCenter = new Vector2(7.5f, 8.5f);
        public float boardWidth = 16f;
        public float boardHeight = 18f;

        [Header("Padding")]
        public float paddingPercent = 0.1f;

        [Header("Zoom Settings")]
        public float minZoom = 1.0f;   // 100% = full board visible
        public float maxZoom = 2.5f;   // 250% = zoomed in
        public float doubleTapZoom = 2.5f;
        public float zoomAnimDuration = 0.25f;

        [Header("Pan Settings")]
        public float panAnimDuration = 0.25f;

        private Camera _camera;
        private float _lastAspect;
        private ScreenOrientation _lastOrientation;

        // Base size when zoom = 1.0 (fits whole board)
        private float _baseCameraSize;

        // Current zoom level (1.0 = 100%, 2.5 = 250%)
        private float _currentZoom = 1.0f;

        // Pan offset from board center (in world units)
        private Vector2 _panOffset = Vector2.zero;

        // Animation state
        private bool _isAnimating;
        private float _animStartTime;
        private float _animDuration;
        private float _zoomStart;
        private float _zoomTarget;
        private Vector2 _panStart;
        private Vector2 _panTarget;  // Already clamped for target zoom level

        public float CurrentZoom => _currentZoom;
        public float BaseCameraSize => _baseCameraSize;
        public bool IsAnimating => _isAnimating;
        public Camera Camera => _camera;

        private void Start()
        {
            _camera = GetComponent<Camera>();
            CalculateBaseCameraSize();
            ApplyCameraState();
        }

        private void Update()
        {
            // Check if aspect ratio or orientation changed
            if (Mathf.Abs(_camera.aspect - _lastAspect) > 0.01f ||
                Screen.orientation != _lastOrientation)
            {
                CalculateBaseCameraSize();
                ApplyCameraState();
            }

            // Handle zoom/pan animation
            if (_isAnimating)
            {
                float elapsed = Time.time - _animStartTime;
                float t = Mathf.Clamp01(elapsed / _animDuration);

                // Smooth ease in-out
                t = t * t * (3f - 2f * t);

                // Interpolate zoom and pan together
                // Don't clamp during animation - targets are pre-clamped
                _currentZoom = Mathf.Lerp(_zoomStart, _zoomTarget, t);
                _panOffset = Vector2.Lerp(_panStart, _panTarget, t);

                ApplyCameraStateNoClamp();

                if (t >= 1f)
                {
                    _isAnimating = false;
                    // Final application with clamp to ensure we're exactly on target
                    _currentZoom = _zoomTarget;
                    _panOffset = _panTarget;
                    ApplyCameraState();
                }
            }
        }

        /// <summary>
        /// Calculates the camera size needed to fit the whole board.
        /// </summary>
        private void CalculateBaseCameraSize()
        {
            _lastAspect = _camera.aspect;
            _lastOrientation = Screen.orientation;

            float paddedWidth = boardWidth * (1f + paddingPercent);
            float paddedHeight = boardHeight * (1f + paddingPercent);

            float verticalSize = paddedHeight / 2f;
            float horizontalSize = paddedWidth / (2f * _camera.aspect);

            _baseCameraSize = Mathf.Max(verticalSize, horizontalSize);

            Debug.Log($"Camera base size calculated: {_baseCameraSize:F2}, Aspect: {_camera.aspect:F2}");
        }

        /// <summary>
        /// Applies current zoom and pan to the camera (with clamping).
        /// </summary>
        private void ApplyCameraState()
        {
            _camera.orthographic = true;
            _camera.orthographicSize = _baseCameraSize / _currentZoom;

            // Clamp pan offset to keep board on screen
            _panOffset = ClampPanOffset(_panOffset);

            ApplyCameraPosition();
        }

        /// <summary>
        /// Applies current zoom and pan to the camera (without clamping - for animation).
        /// </summary>
        private void ApplyCameraStateNoClamp()
        {
            _camera.orthographic = true;
            _camera.orthographicSize = _baseCameraSize / _currentZoom;
            ApplyCameraPosition();
        }

        /// <summary>
        /// Sets camera position based on current pan offset.
        /// </summary>
        private void ApplyCameraPosition()
        {
            float camX = boardCenter.x + _panOffset.x;
            float camZ = boardCenter.y + _panOffset.y;
            transform.position = new Vector3(camX, 20f, camZ);
            transform.rotation = Quaternion.Euler(90f, 0f, 0f);
        }

        /// <summary>
        /// Clamps pan offset so board edges stay on screen.
        /// </summary>
        private Vector2 ClampPanOffset(Vector2 pan)
        {
            float currentSize = _baseCameraSize / _currentZoom;
            float viewWidth = currentSize * 2f * _camera.aspect;
            float viewHeight = currentSize * 2f;

            // How much can we pan before board edge hits screen edge?
            float maxPanX = Mathf.Max(0f, (boardWidth - viewWidth) / 2f);
            float maxPanY = Mathf.Max(0f, (boardHeight - viewHeight) / 2f);

            return new Vector2(
                Mathf.Clamp(pan.x, -maxPanX, maxPanX),
                Mathf.Clamp(pan.y, -maxPanY, maxPanY)
            );
        }

        /// <summary>
        /// Clamps pan offset for a specific zoom level (used for animation target).
        /// </summary>
        private Vector2 ClampPanOffsetForZoom(Vector2 pan, float zoom)
        {
            float sizeAtZoom = _baseCameraSize / zoom;
            float viewWidth = sizeAtZoom * 2f * _camera.aspect;
            float viewHeight = sizeAtZoom * 2f;

            float maxPanX = Mathf.Max(0f, (boardWidth - viewWidth) / 2f);
            float maxPanY = Mathf.Max(0f, (boardHeight - viewHeight) / 2f);

            return new Vector2(
                Mathf.Clamp(pan.x, -maxPanX, maxPanX),
                Mathf.Clamp(pan.y, -maxPanY, maxPanY)
            );
        }

        /// <summary>
        /// Sets zoom level immediately (no animation).
        /// </summary>
        public void SetZoom(float zoom)
        {
            _currentZoom = Mathf.Clamp(zoom, minZoom, maxZoom);
            ApplyCameraState();
        }

        /// <summary>
        /// Adds to current zoom (for pinch gestures).
        /// </summary>
        public void AddZoom(float delta, Vector2 worldFocusPoint)
        {
            float oldZoom = _currentZoom;
            _currentZoom = Mathf.Clamp(_currentZoom + delta, minZoom, maxZoom);

            if (Mathf.Approximately(oldZoom, _currentZoom)) return;

            // Adjust pan to keep focus point stationary
            // This makes pinch feel natural - the point between fingers stays put
            Vector2 focusOffset = worldFocusPoint - boardCenter - _panOffset;
            float zoomRatio = _currentZoom / oldZoom;
            Vector2 newFocusOffset = focusOffset * zoomRatio;
            _panOffset += focusOffset - newFocusOffset;

            ApplyCameraState();
        }

        /// <summary>
        /// Adds to current pan offset (for drag gestures).
        /// </summary>
        public void AddPan(Vector2 worldDelta)
        {
            _panOffset -= worldDelta;  // Subtract because dragging right should move camera left
            ApplyCameraState();
        }

        /// <summary>
        /// Animates zoom to target level, optionally focusing on a world point.
        /// </summary>
        public void AnimateZoomTo(float targetZoom, Vector2? focusWorldPoint = null)
        {
            targetZoom = Mathf.Clamp(targetZoom, minZoom, maxZoom);

            _zoomStart = _currentZoom;
            _zoomTarget = targetZoom;
            _panStart = _panOffset;

            if (focusWorldPoint.HasValue && targetZoom > minZoom)
            {
                // Zooming in: calculate target pan to center on focus point
                // Then clamp it at the TARGET zoom level
                Vector2 desiredPan = focusWorldPoint.Value - boardCenter;
                _panTarget = ClampPanOffsetForZoom(desiredPan, targetZoom);
            }
            else
            {
                // Zooming out: return to board center
                _panTarget = Vector2.zero;
            }

            _animStartTime = Time.time;
            _animDuration = zoomAnimDuration;
            _isAnimating = true;
        }

        /// <summary>
        /// Toggles between min zoom (100%) and double-tap zoom level.
        /// </summary>
        public void ToggleZoom(Vector2 worldTapPoint)
        {
            if (_currentZoom > minZoom + 0.1f)
            {
                // Currently zoomed in - zoom out to center
                AnimateZoomTo(minZoom, null);
            }
            else
            {
                // Currently at min zoom - zoom in on tap point
                AnimateZoomTo(doubleTapZoom, worldTapPoint);
            }
        }

        /// <summary>
        /// Converts screen position to world position on the board plane (Y=0).
        /// </summary>
        public Vector3 ScreenToWorldOnBoard(Vector2 screenPos)
        {
            Ray ray = _camera.ScreenPointToRay(screenPos);
            float t = -ray.origin.y / ray.direction.y;
            return ray.origin + ray.direction * t;
        }

        /// <summary>
        /// Resets zoom and pan to default (full board view).
        /// </summary>
        public void ResetView()
        {
            _currentZoom = minZoom;
            _panOffset = Vector2.zero;
            ApplyCameraState();
        }
    }
}