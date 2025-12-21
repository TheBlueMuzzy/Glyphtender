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

            _isDragging = true;
            _originalPosition = transform.position;
            _originalScale = transform.localScale;
            _originalParent = transform.parent;

            // Unparent so it moves in world space
            transform.SetParent(null);

            // Scale up slightly while dragging
            transform.localScale = _originalScale * 1.2f;

            // Select this letter
            GameManager.Instance.SelectLetter(Letter);
            Controller.SetSelectedIndex(Index);

            Debug.Log($"Started dragging letter {Letter}");
        }

        private void OnMouseDrag()
        {
            if (!_isDragging) return;

            // Move tile to follow cursor
            Vector3 mouseWorldPos = GetMouseWorldPosition();
            transform.position = mouseWorldPos;

            // Check which hex we're hovering over
            HexCoord? newHoveredHex = _boardRenderer.WorldToHex(mouseWorldPos);

            if (newHoveredHex != _hoveredHex)
            {
                _hoveredHex = newHoveredHex;

                // Show ghost tile if over a valid cast position
                if (_hoveredHex != null && GameManager.Instance.ValidCasts.Contains(_hoveredHex.Value))
                {
                    _boardRenderer.SetHoverHighlight(_hoveredHex.Value);
                    _boardRenderer.ShowGhostTile(_hoveredHex.Value, Letter, GameManager.Instance.GameState.CurrentPlayer);
                }
                else
                {
                    _boardRenderer.ClearHoverHighlight();
                    _boardRenderer.HideGhostTile();
                }
            }
        }

        private void OnMouseUp()
        {
            if (!_isDragging) return;
            _isDragging = false;

            _boardRenderer.ClearHoverHighlight();

            // Reparent back to hand
            transform.SetParent(_originalParent);
            transform.position = _originalPosition;
            transform.localScale = _originalScale;

            // Check if dropped on valid hex
            if (_hoveredHex != null && GameManager.Instance.ValidCasts.Contains(_hoveredHex.Value))
            {
                // Valid drop - set cast position
                GameManager.Instance.SelectCastPosition(_hoveredHex.Value);
                Controller.ShowConfirmButton();
                Debug.Log($"Dropped letter {Letter} on {_hoveredHex.Value}");
            }
            else
            {
                // Invalid drop - hide ghost, clear letter selection
                _boardRenderer.HideGhostTile();
                GameManager.Instance.ClearPendingLetter();
                Controller.ClearSelectedIndex();
                Debug.Log("Invalid drop - returning letter to hand");
            }

            _hoveredHex = null;
        }

        private Vector3 GetMouseWorldPosition()
        {
            Vector3 mousePos = Input.mousePosition;
            mousePos.z = 10f; // Distance from camera
            return _mainCamera.ScreenToWorldPoint(mousePos);
        }
    }
}