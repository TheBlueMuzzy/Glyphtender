using UnityEngine;
using Glyphtender.Core;

namespace Glyphtender.Unity
{
    /// <summary>
    /// Controls camera positioning, zoom, and panning.
    /// Supports pinch-zoom and bounded panning for mobile.
    /// </summary>
    public class CameraController : MonoBehaviour
    {
        public static CameraController Instance { get; private set; }

        [Header("Portrait Offset")]
        [Tooltip("Y offset for board center in portrait mode (negative = camera sees higher on board)")]
        public float portraitBoardCenterYOffset = -1.5f;

        [Header("Camera Angle")]
        [Tooltip("Camera tilt angle (90 = top-down, 60 = angled)")]
        [Range(30f, 90f)]
        public float cameraAngle = 90f;

        [Header("Padding")]
        public float paddingPercent = 0.1f;

        // Board bounds (calculated from actual board)
        private Vector2 _boardCenter = new Vector2(7.5f, 7.5f);
        private float _boardWidth = 16f;
        private float _boardHeight = 18f;

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

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
        }

        private void Start()
        {
            _camera = GetComponent<Camera>();

            // Subscribe to game events
            if (GameManager.Instance != null)
            {
                GameManager.Instance.OnGameInitialized += OnGameInitialized;
                GameManager.Instance.OnGameRestarted += OnGameRestarted;
            }

            CalculateBaseCameraSize();
            ApplyCameraState();
        }

        private void OnDestroy()
        {
            if (GameManager.Instance != null)
            {
                GameManager.Instance.OnGameInitialized -= OnGameInitialized;
                GameManager.Instance.OnGameRestarted -= OnGameRestarted;
            }
        }

        private void OnGameInitialized()
        {
            UpdateBoardBounds();
            ResetView();
        }

        private void OnGameRestarted()
        {
            UpdateBoardBounds();
            ResetView();
        }

        /// <summary>
        /// Updates board bounds from the current game board.
        /// </summary>
        private void UpdateBoardBounds()
        {
            if (GameManager.Instance?.GameState?.Board == null) return;

            var board = GameManager.Instance.GameState.Board;

            // Calculate actual board bounds from hex positions
            float minX = float.MaxValue, maxX = float.MinValue;
            float minZ = float.MaxValue, maxZ = float.MinValue;

            foreach (var hex in board.BoardHexes)
            {
                Vector3 worldPos = HexCoordConverter.HexToWorld(hex);
                minX = Mathf.Min(minX, worldPos.x);
                maxX = Mathf.Max(maxX, worldPos.x);
                minZ = Mathf.Min(minZ, worldPos.z);
                maxZ = Mathf.Max(maxZ, worldPos.z);
            }

            // Add hex radius to bounds
            float hexRadius = HexCoordConverter.DefaultHexSpacing * 0.9f;
            minX -= hexRadius;
            maxX += hexRadius;
            minZ -= hexRadius;
            maxZ += hexRadius;

            _boardWidth = maxX - minX;
            _boardHeight = maxZ - minZ;
            _boardCenter = new Vector2((minX + maxX) / 2f, (minZ + maxZ) / 2f);

            Debug.Log($"Board bounds updated for {board.Size}: Center={_boardCenter}, Width={_boardWidth:F1}, Height={_boardHeight:F1}");

            CalculateBaseCameraSize();
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

            float paddedWidth = _boardWidth * (1f + paddingPercent);
            float paddedHeight = _boardHeight * (1f + paddingPercent);

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
        /// Sets camera position based on current pan offset and angle.
        /// </summary>
        private void ApplyCameraPosition()
        {
            float camX = _boardCenter.x + _panOffset.x;
            float camZ = _boardCenter.y + _panOffset.y;

            // Apply portrait offset
            if (Screen.height > Screen.width)
            {
                camZ += portraitBoardCenterYOffset;
            }

            // Calculate camera height and Z offset based on angle
            float distanceFromBoard = 20f;
            float angleRad = cameraAngle * Mathf.Deg2Rad;
            float camY = distanceFromBoard * Mathf.Sin(angleRad);
            float camZOffset = -distanceFromBoard * Mathf.Cos(angleRad);

            transform.position = new Vector3(camX, camY, camZ + camZOffset);
            transform.rotation = Quaternion.Euler(cameraAngle, 0f, 0f);
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
            float maxPanX = Mathf.Max(0f, (_boardWidth - viewWidth) / 2f);
            float maxPanY = Mathf.Max(0f, (_boardHeight - viewHeight) / 2f);

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

            float maxPanX = Mathf.Max(0f, (_boardWidth - viewWidth) / 2f);
            float maxPanY = Mathf.Max(0f, (_boardHeight - viewHeight) / 2f);

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
            Vector2 focusOffset = worldFocusPoint - _boardCenter - _panOffset;
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
                Vector2 desiredPan = focusWorldPoint.Value - _boardCenter;
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