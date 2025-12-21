using UnityEngine;
using Glyphtender.Core;

namespace Glyphtender.Unity
{
    /// <summary>
    /// Handles drag and drop input for hand tiles.
    /// Only active when GameManager.CurrentInputMode is Drag.
    /// </summary>
    public class HandTileDragHandler : MonoBehaviour
    {
        public HandController Controller { get; set; }
        public int Index { get; set; }
        public char Letter { get; set; }

        private bool _isDragging;
        private Vector3 _originalPosition;
        private static HandTileDragHandler _currentlyPlacedTile;
        private Vector3 _originalScale;
        private Transform _originalParent;
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

            // Only allow after glyphling has moved
            if (GameManager.Instance.PendingDestination == null)
            {
                Debug.Log("Move your glyphling first!");
                return;
            }

            // If another tile is already placed, return it to hand first
            if (_currentlyPlacedTile != null && _currentlyPlacedTile != this)
            {
                _currentlyPlacedTile.ReturnToHand();
            }

            _isDragging = true;
            _originalPosition = transform.position;
            _originalScale = transform.localScale;
            _originalParent = transform.parent;

            // Unparent so it moves in world space
            transform.SetParent(null);

            // Keep same visual size as in hand
            transform.localScale = new Vector3(
                _originalScale.x * 1.2f,
                _originalScale.y,
                _originalScale.z * 1.2f);

            // Select this letter
            GameManager.Instance.SelectLetter(Letter);
            Controller.SetSelectedIndex(Index);

            Debug.Log($"Started dragging letter {Letter}");
        }

        private void Update()
        {
            if (!_isDragging) return;

            // Move tile to follow cursor
            Vector3 mouseWorldPos = GetMouseWorldPosition();
            transform.position = new Vector3(mouseWorldPos.x, 0.5f, mouseWorldPos.z);

            // Check which hex we're hovering over
            HexCoord? newHoveredHex = _boardRenderer.WorldToHex(mouseWorldPos);

            if (newHoveredHex != _hoveredHex)
            {
                _hoveredHex = newHoveredHex;

                // Show highlight if over a valid cast position
                if (_hoveredHex != null && GameManager.Instance.ValidCasts.Contains(_hoveredHex.Value))
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
            if (_hoveredHex != null && GameManager.Instance.ValidCasts.Contains(_hoveredHex.Value))
            {
                // Valid drop - set cast position and move tile to board
                GameManager.Instance.SelectCastPosition(_hoveredHex.Value);

                // Position tile on the board at same scale as hand
                Vector3 boardPos = _boardRenderer.HexToWorld(_hoveredHex.Value) + Vector3.up * 0.2f;
                transform.position = boardPos;
                transform.localScale = _originalScale;
                transform.localRotation = Quaternion.Euler(0f, 0f, 0f);

                // Track this as the currently placed tile
                _currentlyPlacedTile = this;

                // Show confirm button
                Controller.ShowConfirmButton();

                Debug.Log($"Dropped letter {Letter} on {_hoveredHex.Value}");
            }
            else
            {
                // Invalid drop - return to hand
                ReturnToHand();

                Debug.Log("Invalid drop - returning letter to hand");
            }

            _hoveredHex = null;
        }

        public void ReturnToHand()
        {
            transform.SetParent(_originalParent);
            transform.position = _originalPosition;
            transform.localScale = _originalScale;
            transform.localRotation = Quaternion.Euler(90f, 0f, 0f);

            if (_currentlyPlacedTile == this)
            {
                _currentlyPlacedTile = null;
            }

            GameManager.Instance.ClearPendingLetter();
            GameManager.Instance.ClearPendingCastPosition();
            Controller.ClearSelectedIndex();
            Controller.HideConfirmButton();
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