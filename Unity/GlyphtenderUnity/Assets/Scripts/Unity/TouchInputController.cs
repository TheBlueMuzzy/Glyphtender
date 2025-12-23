using UnityEngine;
using System.Collections.Generic;

namespace Glyphtender.Unity
{
    /// <summary>
    /// Handles touch input for mobile devices.
    /// Manages pan, pinch zoom, and double-tap zoom.
    /// Coordinates with existing click handlers for selectables.
    /// </summary>
    public class TouchInputController : MonoBehaviour
    {
        [Header("Tap Settings")]
        public float tapDistanceThreshold = 20f;  // Pixels - movement beyond this = drag, not tap
        public float doubleTapTime = 0.3f;        // Seconds between taps for double-tap

        [Header("References")]
        public CameraController cameraController;
        public Camera uiCamera;  // Reference to UI camera for raycasting UI elements

        // Touch tracking
        private Dictionary<int, TouchData> _activeTouches = new Dictionary<int, TouchData>();

        // Double-tap tracking
        private float _lastTapTime;
        private Vector2 _lastTapPosition;

        // Pinch tracking
        private float _initialPinchDistance;
        private float _pinchZoomStart;

        // Layer masks
        [SerializeField] private LayerMask _boardLayerMask;
        [SerializeField] private LayerMask _uiLayerMask;

        [SerializeField] private Camera _mainCamera;

        private class TouchData
        {
            public Vector2 startPosition;
            public Vector2 currentPosition;
            public Vector2 previousPosition;
            public bool isOnSelectable;
            public bool hasMoved;  // Moved beyond tap threshold
            public GameObject hitObject;
        }

        private void Start()
        {
            if (_mainCamera == null)
                _mainCamera = _mainCamera ;

            if (cameraController == null)
            {
                cameraController = FindObjectOfType<CameraController>();
            }

            // Find UI camera if not set
            if (uiCamera == null)
            {
                var uiCamObj = GameObject.Find("UICamera");
                if (uiCamObj != null)
                {
                    uiCamera = uiCamObj.GetComponent<Camera>();
                }
            }
        }

        private void Update()
        {
            // Skip if no camera controller
            if (cameraController == null) return;

            // Skip board input when menu is open
            if (MenuController.Instance != null && MenuController.Instance.IsOpen) return;

            // Handle touch input
            if (Input.touchCount > 0)
            {
                HandleTouches();
            }

            // Also handle mouse input for editor testing
#if UNITY_EDITOR
            HandleMouseInput();
#endif
        }

        private void HandleTouches()
        {
            // Process each touch
            foreach (Touch touch in Input.touches)
            {
                switch (touch.phase)
                {
                    case TouchPhase.Began:
                        OnTouchBegan(touch);
                        break;

                    case TouchPhase.Moved:
                    case TouchPhase.Stationary:
                        OnTouchMoved(touch);
                        break;

                    case TouchPhase.Ended:
                    case TouchPhase.Canceled:
                        OnTouchEnded(touch);
                        break;
                }
            }

            // Handle pinch zoom when two fingers are down (but not while dragging)
            if (Input.touchCount == 2)
            {
                bool isDragging = HandTileDragHandler.IsDraggingTile || HexDragHandler.IsDraggingGlyphling;

                if (isDragging)
                {
                    // While dragging with finger 1, finger 2 pans instead of zooming
                    // Use the second touch directly for panning
                    Touch touch0 = Input.GetTouch(0);
                    Touch touch1 = Input.GetTouch(1);

                    // Figure out which touch is NOT the dragging one
                    // The dragging touch is on a selectable, so use the other one
                    Touch panTouch = touch1;
                    if (_activeTouches.TryGetValue(touch0.fingerId, out TouchData data0) && !data0.isOnSelectable)
                    {
                        panTouch = touch0;
                    }

                    // Pan using this touch's delta
                    if (panTouch.phase == TouchPhase.Moved)
                    {
                        Vector2 previousPos = panTouch.position - panTouch.deltaPosition;
                        HandleSingleFingerPan(previousPos, panTouch.position);
                    }
                }
                else
                {
                    HandlePinchZoom();
                }
            }
        }

        private void OnTouchBegan(Touch touch)
        {
            Debug.Log($"OnTouchBegan: pos={touch.position}, uiCam={uiCamera != null}, mainCam={_mainCamera  != null}, uiMask={_uiLayerMask.value}, boardMask={_boardLayerMask.value}");
            bool hitSelectable = false;
            GameObject hitObject = null;

            // First, raycast with UI camera for UI elements (buttons, hand tiles)
            if (uiCamera != null)
            {
                Ray uiRay = uiCamera.ScreenPointToRay(touch.position);
                RaycastHit uiHit;

                if (Physics.Raycast(uiRay, out uiHit, 100f, _uiLayerMask))
                {
                    hitSelectable = IsSelectable(uiHit.collider.gameObject);
                    hitObject = uiHit.collider.gameObject;
                }
            }

            // If no UI hit, raycast with main camera for board elements
            if (hitObject == null)
            {
                Ray boardRay = _mainCamera .ScreenPointToRay(touch.position);
                RaycastHit boardHit;

                if (Physics.Raycast(boardRay, out boardHit, 100f, _boardLayerMask))
                {
                    hitSelectable = IsSelectable(boardHit.collider.gameObject);
                    hitObject = boardHit.collider.gameObject;
                }
            }

            _activeTouches[touch.fingerId] = new TouchData
            {
                startPosition = touch.position,
                currentPosition = touch.position,
                previousPosition = touch.position,
                isOnSelectable = hitSelectable,
                hasMoved = false,
                hitObject = hitObject
            };

            // If starting a two-finger gesture, record pinch data
            if (Input.touchCount == 2)
            {
                _initialPinchDistance = Vector2.Distance(
                    Input.GetTouch(0).position,
                    Input.GetTouch(1).position
                );
                _pinchZoomStart = cameraController.CurrentZoom;
            }
        }

        private void OnTouchMoved(Touch touch)
        {
            if (!_activeTouches.TryGetValue(touch.fingerId, out TouchData data))
                return;

            data.previousPosition = data.currentPosition;
            data.currentPosition = touch.position;

            // Check if moved beyond tap threshold
            if (!data.hasMoved)
            {
                float distance = Vector2.Distance(touch.position, data.startPosition);
                if (distance > tapDistanceThreshold)
                {
                    data.hasMoved = true;
                }
            }

            // Single finger pan (only if not on selectable, has moved, and not dragging)
            if (Input.touchCount == 1 && data.hasMoved && !data.isOnSelectable &&
                !HandTileDragHandler.IsDraggingTile && !HexDragHandler.IsDraggingGlyphling)
            {
                HandleSingleFingerPan(data.previousPosition, data.currentPosition);
            }
        }

        private void OnTouchEnded(Touch touch)
        {
            if (!_activeTouches.TryGetValue(touch.fingerId, out TouchData data))
                return;

            // Check for double-tap (only if didn't move and single finger)
            if (!data.hasMoved && Input.touchCount <= 1)
            {
                float timeSinceLastTap = Time.time - _lastTapTime;
                float distanceFromLastTap = Vector2.Distance(touch.position, _lastTapPosition);

                if (timeSinceLastTap < doubleTapTime && distanceFromLastTap < tapDistanceThreshold * 2)
                {
                    // Double tap detected
                    OnDoubleTap(touch.position);
                    _lastTapTime = 0f;  // Reset to prevent triple-tap
                }
                else
                {
                    // Single tap - record for potential double-tap
                    _lastTapTime = Time.time;
                    _lastTapPosition = touch.position;

                    // If tapped on empty space (not selectable), this was just a tap on nothing
                    // Selectables handle themselves via OnMouseDown
                }
            }

            _activeTouches.Remove(touch.fingerId);
        }

        private void HandleSingleFingerPan(Vector2 previousScreenPos, Vector2 currentScreenPos)
        {
            // Don't pan while animating
            if (cameraController.IsAnimating) return;

            // Convert screen positions to world positions
            Vector3 worldBefore = cameraController.ScreenToWorldOnBoard(previousScreenPos);
            Vector3 worldAfter = cameraController.ScreenToWorldOnBoard(currentScreenPos);
            Vector2 worldDelta = new Vector2(worldAfter.x - worldBefore.x, worldAfter.z - worldBefore.z);

            cameraController.AddPan(worldDelta);
        }

        private void HandlePinchZoom()
        {
            // Don't zoom while animating
            if (cameraController.IsAnimating) return;

            Touch touch0 = Input.GetTouch(0);
            Touch touch1 = Input.GetTouch(1);

            float currentDistance = Vector2.Distance(touch0.position, touch1.position);

            if (_initialPinchDistance > 0f)
            {
                // Calculate zoom based on pinch ratio
                float pinchRatio = currentDistance / _initialPinchDistance;
                float targetZoom = _pinchZoomStart * pinchRatio;

                // Get midpoint for focus
                Vector2 midpoint = (touch0.position + touch1.position) / 2f;
                Vector3 worldMidpoint = cameraController.ScreenToWorldOnBoard(midpoint);
                Vector2 worldFocus = new Vector2(worldMidpoint.x, worldMidpoint.z);

                // Calculate delta from current zoom
                float delta = targetZoom - cameraController.CurrentZoom;
                cameraController.AddZoom(delta, worldFocus);
            }
        }

        private void OnDoubleTap(Vector2 screenPosition)
        {
            Vector3 worldPos = cameraController.ScreenToWorldOnBoard(screenPosition);
            Vector2 worldPoint = new Vector2(worldPos.x, worldPos.z);

            cameraController.ToggleZoom(worldPoint);

            Debug.Log($"Double tap at world position: {worldPoint}");
        }

        /// <summary>
        /// Determines if a GameObject is currently selectable based on game state.
        /// </summary>
        private bool IsSelectable(GameObject obj)
        {
            if (obj == null) return false;
            if (GameManager.Instance == null) return false;

            // Check for hex click handler
            var hexHandler = obj.GetComponent<HexClickHandler>();
            if (hexHandler != null)
            {
                // Hex is selectable if:
                // 1. It's a valid move destination
                // 2. It's a valid cast position
                // 3. It has a current player's glyphling on it
                if (GameManager.Instance.ValidMoves.Contains(hexHandler.Coord) ||
                    GameManager.Instance.ValidCasts.Contains(hexHandler.Coord))
                {
                    return true;
                }

                // Check for glyphling at this hex
                var glyphling = hexHandler.BoardRenderer?.GetGlyphlingAt(hexHandler.Coord);
                if (glyphling != null && glyphling.Owner == GameManager.Instance.GameState.CurrentPlayer)
                {
                    var turnState = GameManager.Instance.CurrentTurnState;
                    if (turnState == GameTurnState.Idle ||
                        turnState == GameTurnState.GlyphlingSelected ||
                        turnState == GameTurnState.MovePending ||
                        turnState == GameTurnState.ReadyToConfirm)
                    {
                        return true;
                    }
                }

                return false;
            }

            // Check for hand tile click handler
            var tileHandler = obj.GetComponent<HandTileClickHandler>();
            if (tileHandler != null)
            {
                // Hand tiles are selectable when we need to select a letter
                // or during cycle mode
                var turnState = GameManager.Instance.CurrentTurnState;
                return turnState == GameTurnState.MovePending ||
                       turnState == GameTurnState.ReadyToConfirm ||
                       turnState == GameTurnState.CycleMode;
            }

            // Check for button click handler
            var buttonHandler = obj.GetComponent<ButtonClickHandler>();
            if (buttonHandler != null)
            {
                // Buttons are always selectable when visible
                return obj.activeInHierarchy;
            }

            return false;
        }

#if UNITY_EDITOR
        // Mouse input handling for editor testing
        private Vector2 _mouseDownPosition;
        private Vector2 _mousePreviousPosition;
        private bool _mouseIsDown;
        private bool _mouseHasMoved;
        private bool _mouseOnSelectable;
        private float _lastMouseClickTime;
        private Vector2 _lastMouseClickPosition;

        private void HandleMouseInput()
        {
            // Middle mouse or right mouse for pan (editor convenience)
            if (Input.GetMouseButtonDown(1) || Input.GetMouseButtonDown(2))
            {
                _mousePreviousPosition = Input.mousePosition;
            }

            if (Input.GetMouseButton(1) || Input.GetMouseButton(2))
            {
                Vector2 currentPos = Input.mousePosition;
                if (Vector2.Distance(currentPos, _mousePreviousPosition) > 0.1f)
                {
                    HandleSingleFingerPan(_mousePreviousPosition, currentPos);
                    _mousePreviousPosition = currentPos;
                }
            }

            // Scroll wheel for zoom
            float scroll = Input.GetAxis("Mouse ScrollWheel");
            if (Mathf.Abs(scroll) > 0.001f)
            {
                Vector3 worldPos = cameraController.ScreenToWorldOnBoard(Input.mousePosition);
                Vector2 worldFocus = new Vector2(worldPos.x, worldPos.z);
                cameraController.AddZoom(scroll * 2f, worldFocus);
            }

            // Left click handling for double-click zoom test
            if (Input.GetMouseButtonDown(0))
            {
                _mouseOnSelectable = false;

                // First, raycast with UI camera for UI elements
                if (uiCamera != null)
                {
                    Ray uiRay = uiCamera.ScreenPointToRay(Input.mousePosition);
                    RaycastHit uiHit;

                    if (Physics.Raycast(uiRay, out uiHit, 100f, _uiLayerMask))
                    {
                        _mouseOnSelectable = IsSelectable(uiHit.collider.gameObject);
                    }
                }

                // If no UI hit, raycast with main camera for board elements
                if (!_mouseOnSelectable)
                {
                    Ray boardRay = _mainCamera .ScreenPointToRay(Input.mousePosition);
                    RaycastHit boardHit;

                    if (Physics.Raycast(boardRay, out boardHit, 100f, _boardLayerMask))
                    {
                        _mouseOnSelectable = IsSelectable(boardHit.collider.gameObject);
                    }
                }

                _mouseDownPosition = Input.mousePosition;
                _mousePreviousPosition = Input.mousePosition;
                _mouseIsDown = true;
                _mouseHasMoved = false;
            }

            if (Input.GetMouseButton(0) && _mouseIsDown)
            {
                Vector2 currentPos = Input.mousePosition;
                float distance = Vector2.Distance(currentPos, _mouseDownPosition);

                if (distance > tapDistanceThreshold)
                {
                    _mouseHasMoved = true;

                    // Pan with left mouse if not on selectable and not dragging
                    if (!_mouseOnSelectable && !HandTileDragHandler.IsDraggingTile && !HexDragHandler.IsDraggingGlyphling)
                    {
                        HandleSingleFingerPan(_mousePreviousPosition, currentPos);
                    }
                }

                _mousePreviousPosition = currentPos;
            }

            if (Input.GetMouseButtonUp(0) && _mouseIsDown)
            {
                _mouseIsDown = false;

                if (!_mouseHasMoved && !_mouseOnSelectable)
                {
                    // Check for double-click
                    float timeSinceLastClick = Time.time - _lastMouseClickTime;
                    float distanceFromLastClick = Vector2.Distance(Input.mousePosition, _lastMouseClickPosition);

                    if (timeSinceLastClick < doubleTapTime && distanceFromLastClick < tapDistanceThreshold * 2)
                    {
                        OnDoubleTap(Input.mousePosition);
                        _lastMouseClickTime = 0f;
                    }
                    else
                    {
                        _lastMouseClickTime = Time.time;
                        _lastMouseClickPosition = Input.mousePosition;
                    }
                }
            }
        }
#endif
    }
}