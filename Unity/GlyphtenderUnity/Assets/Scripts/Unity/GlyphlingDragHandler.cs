using UnityEngine;
using Glyphtender.Core;

namespace Glyphtender.Unity
{
    /// <summary>
    /// Handles drag and drop input for glyphlings.
    /// Only active when GameManager.CurrentInputMode is Drag.
    /// </summary>
    public class GlyphlingDragHandler : MonoBehaviour
    {
        public Glyphling Glyphling { get; set; }

        private bool _isDragging;
        private Vector3 _originalPosition;
        private Camera _mainCamera;
        private BoardRenderer _boardRenderer;
        private HexCoord? _hoveredHex;

        private void Start()
        {
            _mainCamera = Camera.main;
            _boardRenderer = FindObjectOfType<BoardRenderer>();
        }

        private void OnMouseDown()
        {
            // Only handle in drag mode
            if (GameManager.Instance.CurrentInputMode != GameManager.InputMode.Drag)
                return;

            // Don't allow if game is over
            if (GameManager.Instance.GameState.IsGameOver)
                return;

            // Don't allow during cycle mode
            if (GameManager.Instance.IsInCycleMode)
                return;

            // Can only drag own glyphlings
            if (Glyphling.Owner != GameManager.Instance.GameState.CurrentPlayer)
            {
                Debug.Log("Not your glyphling!");
                return;
            }

            // If another glyphling was already moved, reset first
            if (GameManager.Instance.SelectedGlyphling != null &&
                GameManager.Instance.SelectedGlyphling != Glyphling &&
                GameManager.Instance.PendingDestination != null)
            {
                GameManager.Instance.ResetMove();
            }

            _isDragging = true;
            // Get the logical position from game state, converted to world position
            _originalPosition = _boardRenderer.HexToWorld(Glyphling.Position) + Vector3.up * 0.3f;

            // Select this glyphling to show valid moves
            GameManager.Instance.SelectGlyphling(Glyphling);

            Debug.Log($"Started dragging glyphling at {Glyphling.Position}");
        }

        private void Update()
        {
            if (!_isDragging) return;

            // Move glyphling to follow cursor
            Vector3 mouseWorldPos = GetMouseWorldPosition();
            transform.position = new Vector3(mouseWorldPos.x, _originalPosition.y, mouseWorldPos.z);

            // Check which hex we're hovering over
            HexCoord? newHoveredHex = _boardRenderer.WorldToHex(mouseWorldPos);

            if (newHoveredHex != _hoveredHex)
            {
                _hoveredHex = newHoveredHex;

                // Update hover highlight if over a valid move
                if (_hoveredHex != null && GameManager.Instance.ValidMoves.Contains(_hoveredHex.Value))
                {
                    _boardRenderer.SetHoverHighlight(_hoveredHex.Value);
                }
                else
                {
                    _boardRenderer.ClearHoverHighlight();
                }
            }

            // Check for mouse release
            if (Input.GetMouseButtonUp(0))
            {
                EndDrag();
            }
        }

        private void EndDrag()
        {
            _isDragging = false;
            _boardRenderer.ClearHoverHighlight();

            // Check if dropped on valid hex
            if (_hoveredHex != null && GameManager.Instance.ValidMoves.Contains(_hoveredHex.Value))
            {
                // Valid drop - move to destination
                GameManager.Instance.SelectDestination(_hoveredHex.Value);
                Debug.Log($"Dropped glyphling on {_hoveredHex.Value}");
            }
            else
            {
                // Invalid drop - return to original position
                transform.position = _originalPosition;
                GameManager.Instance.ResetMove();
                Debug.Log("Invalid drop - returning glyphling");
            }

            _hoveredHex = null;
        }

        private Vector3 GetMouseWorldPosition()
        {
            // Cast ray from camera through mouse position to board plane (y=0)
            Ray ray = _mainCamera.ScreenPointToRay(Input.mousePosition);
            Plane boardPlane = new Plane(Vector3.up, Vector3.zero);

            if (boardPlane.Raycast(ray, out float distance))
            {
                return ray.GetPoint(distance);
            }

            return transform.position;
        }
    }
}