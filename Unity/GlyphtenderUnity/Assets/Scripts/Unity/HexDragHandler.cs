using UnityEngine;
using Glyphtender.Core;

namespace Glyphtender.Unity
{
    /// <summary>
    /// Handles drag input on hex tiles for glyphling movement.
    /// Attached to each hex GameObject by BoardRenderer.
    /// 
    /// Tap a hex with your glyphling to start dragging it.
    /// Drop on a valid move destination to move.
    /// 
    /// Only active when GameManager.CurrentInputMode is Drag.
    /// </summary>
    public class HexDragHandler : MonoBehaviour
    {
        public HexCoord Coord { get; set; }
        public BoardRenderer BoardRenderer { get; set; }

        private bool _isDragging;
        private Glyphling _draggedGlyphling;
        private GameObject _draggedObject;
        private Vector3 _originalPosition;
        private HexCoord? _hoveredHex;
        private Camera _mainCamera;
        private int _dragFingerId = -1;  // Track which finger started the drag

        /// <summary>
        /// True if any glyphling is currently being dragged.
        /// Used by TouchInputController to disable panning.
        /// </summary>
        public static bool IsDraggingGlyphling
        {
            get
            {
                if (InputStateManager.Instance == null) return false;
                return InputStateManager.Instance.IsGlyphlingDragging;
            }
        }

        private void Start()
        {
            _mainCamera = Camera.main;
        }

        private void OnMouseDown()
        {
            // Block input when menu is open
            if (MenuController.Instance != null && MenuController.Instance.IsOpen)
                return;

            // Only handle in drag mode
            if (GameManager.Instance == null) return;
            if (GameManager.Instance.CurrentInputMode != GameManager.InputMode.Drag)
                return;

            // Don't allow board interaction during cycle mode
            if (GameManager.Instance.CurrentTurnState == GameTurnState.CycleMode)
                return;

            var state = GameManager.Instance.GameState;

            // Check if there's a current player's glyphling at this hex
            Glyphling glyphlingHere = BoardRenderer.GetGlyphlingAt(Coord);

            if (glyphlingHere != null && glyphlingHere.Owner == state.CurrentPlayer)
            {
                // If we're mid-turn, reset the current move first
                var turnState = GameManager.Instance.CurrentTurnState;
                if (turnState == GameTurnState.GlyphlingSelected ||
                    turnState == GameTurnState.MovePending ||
                    turnState == GameTurnState.ReadyToConfirm)
                {
                    // Return any placed hand tile back to hand
                    HandTileDragHandler.ReturnCurrentlyPlacedTile();
                    GameManager.Instance.ResetMove();
                }

                // Capture which finger started this drag
                _dragFingerId = -1;  // -1 means mouse
                if (Input.touchCount > 0)
                {
                    // Find the touch that's at this position
                    for (int i = 0; i < Input.touchCount; i++)
                    {
                        Touch t = Input.GetTouch(i);
                        if (t.phase == TouchPhase.Began)
                        {
                            _dragFingerId = t.fingerId;
                            break;
                        }
                    }
                }

                // Start dragging this glyphling
                _draggedGlyphling = glyphlingHere;
                _draggedObject = BoardRenderer.GetGlyphlingObject(glyphlingHere);

                if (_draggedObject != null)
                {
                    // Get original position from glyphling's DATA position, not visual
                    // This ensures we return to correct spot after ResetMove changes data
                    _originalPosition = BoardRenderer.HexToWorld(glyphlingHere.Position) + Vector3.up * 0.3f;

                    // Also sync the visual to match data immediately
                    _draggedObject.transform.position = _originalPosition;

                    _isDragging = true;
                    InputStateManager.Instance.IsGlyphlingDragging = true;

                    // Select this glyphling
                    GameManager.Instance.SelectGlyphling(glyphlingHere);

                    Debug.Log($"Started dragging glyphling from {glyphlingHere.Position}, fingerId={_dragFingerId}");
                }
            }
        }

        private void Update()
        {
            if (!_isDragging || _draggedObject == null) return;

            // Get position from the specific finger that started the drag
            Vector3 screenPos = Vector3.zero;
            bool fingerReleased = false;

            if (_dragFingerId >= 0)
            {
                // Touch input - find our specific finger
                bool foundFinger = false;
                for (int i = 0; i < Input.touchCount; i++)
                {
                    Touch t = Input.GetTouch(i);
                    if (t.fingerId == _dragFingerId)
                    {
                        foundFinger = true;
                        screenPos = t.position;

                        if (t.phase == TouchPhase.Ended || t.phase == TouchPhase.Canceled)
                        {
                            fingerReleased = true;
                        }
                        break;
                    }
                }

                if (!foundFinger)
                {
                    // Finger no longer exists - must have been released
                    fingerReleased = true;
                }
                else if (!fingerReleased)
                {
                    // Move glyphling to follow this specific finger
                    // Convert screen position to world position on the board plane (Y=0)
                    Ray ray = _mainCamera.ScreenPointToRay(screenPos);
                    float distance = ray.origin.y / -ray.direction.y;
                    Vector3 mouseWorldPos = ray.origin + ray.direction * distance;

                    // Apply vertical offset so dragged object is visible above finger
                    float offset = GameSettings.GetDragOffsetWorld();
                    _draggedObject.transform.position = new Vector3(
                        mouseWorldPos.x,
                        0.5f,
                        mouseWorldPos.z + offset
                    );

                    UpdateHoverHighlight(mouseWorldPos + new Vector3(0, 0, offset));
                }
            }
            else
            {
                // Mouse input
                Vector3 mouseWorldPos = InputUtility.GetMouseWorldPosition(_mainCamera);

                // Apply vertical offset so dragged object is visible above finger
                float offset = GameSettings.GetDragOffsetWorld();
                _draggedObject.transform.position = new Vector3(
                    mouseWorldPos.x,
                    0.5f,
                    mouseWorldPos.z + offset
                );

                UpdateHoverHighlight(mouseWorldPos + new Vector3(0, 0, offset));

                if (Input.GetMouseButtonUp(0))
                {
                    fingerReleased = true;
                }
            }

            if (fingerReleased)
            {
                EndDrag();
            }
        }

        private void UpdateHoverHighlight(Vector3 mouseWorldPos)
        {
            // Check which hex we're hovering over
            HexCoord? newHoveredHex = BoardRenderer.WorldToHex(mouseWorldPos);

            if (newHoveredHex != _hoveredHex)
            {
                _hoveredHex = newHoveredHex;

                // Show highlight if over a valid move destination
                if (_hoveredHex != null && GameManager.Instance.ValidMoves.Contains(_hoveredHex.Value))
                {
                    BoardRenderer.SetHoverHighlight(_hoveredHex.Value);
                }
                else
                {
                    BoardRenderer.ClearHoverHighlight();
                }
            }
        }

        private void EndDrag()
        {
            _isDragging = false;
            if (InputStateManager.Instance != null)
            {
                InputStateManager.Instance.IsGlyphlingDragging = false;
            }
            BoardRenderer.ClearHoverHighlight();

            // Check if dropped on valid hex
            if (_hoveredHex != null && GameManager.Instance.ValidMoves.Contains(_hoveredHex.Value))
            {
                // Valid drop - select destination
                GameManager.Instance.SelectDestination(_hoveredHex.Value);

                // Snap glyphling to destination
                Vector3 destPos = BoardRenderer.HexToWorld(_hoveredHex.Value) + Vector3.up * 0.3f;
                _draggedObject.transform.position = destPos;

                Debug.Log($"Dropped glyphling on {_hoveredHex.Value}");
            }
            else
            {
                // Invalid drop - return to original position and reset game state
                _draggedObject.transform.position = _originalPosition;
                GameManager.Instance.ResetMove();

                Debug.Log("Invalid drop - returning glyphling and resetting move");
            }

            _hoveredHex = null;
            _draggedGlyphling = null;
            _draggedObject = null;
        }
    }
}