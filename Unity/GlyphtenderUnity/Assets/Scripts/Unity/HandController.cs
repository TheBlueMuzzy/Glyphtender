using UnityEngine;
using Glyphtender.Core;
using System.Collections.Generic;
using UnityEngine.Rendering;

namespace Glyphtender.Unity
{
    /// <summary>
    /// Manages the player's hand of tiles in 3D space.
    /// Attached to camera so it follows the view.
    /// </summary>
    public class HandController : MonoBehaviour
    {
        [Header("Layout")]
        public float tileSpacing = 1.2f;
        public float tileSize = 0.8f;
 
        public Vector3 handUpPosition = new Vector3(0f, -3f, 6f);
        public Vector3 handDownPosition = new Vector3(0f, -4.5f, 6f);

        [Header("Animation")]
        public float toggleDuration = 0.2f;

        [Header("Materials")]
        public Material yellowTileMaterial;
        public Material blueTileMaterial;
        public Material selectedMaterial;

        [Header("Buttons")]
        public Material confirmMaterial;
        public Material cancelMaterial;
        public float buttonSize = 0.6f;
        public Vector3 confirmButtonOffset = new Vector3(4.5f, 0f, 0f);
        public Vector3 cancelButtonOffset = new Vector3(5.5f, 0f, 0f);

        // State
        private bool _isUp = true;
        private float _lerpTime;
        private Vector3 _lerpStart;
        private Vector3 _lerpTarget;
        private bool _isLerping;

        // Hand tiles
        private List<GameObject> _handTileObjects = new List<GameObject>();
        private List<char> _currentHand = new List<char>();
        private int _selectedIndex = -1;

        // Reference to anchor point
        private Transform _handAnchor;

        // Confirm Button
        private GameObject _confirmButton;
        private bool _confirmVisible;

        // Cancel Button
        private GameObject _cancelButton;

        // Cycle mode
        private bool _isInCycleMode;
        private HashSet<int> _selectedForDiscard = new HashSet<int>();
        private GameObject _cyclePromptText;

        private void Start()
        {
            // Create anchor as child of camera
            _handAnchor = new GameObject("HandAnchor").transform;
            _handAnchor.SetParent(Camera.main.transform);
            _handAnchor.localPosition = handUpPosition;
            _handAnchor.localRotation = Quaternion.Euler(180f, 0f, 0f);

            if (GameManager.Instance != null)
            {
                GameManager.Instance.OnGameStateChanged += RefreshHand;
                GameManager.Instance.OnSelectionChanged += OnSelectionChanged;
                RefreshHand();
            }

            CreateConfirmButton();
            CreateCancelButton();
            CreateCyclePrompt();
        }

        private void CreateCyclePrompt()
        {
            GameObject textObj = new GameObject("CyclePrompt");
            textObj.transform.SetParent(_handAnchor);
            textObj.transform.localPosition = new Vector3(0f, -1f, 0f);
            textObj.transform.localRotation = Quaternion.Euler(180f, 0f, 0f);
            textObj.transform.localScale = new Vector3(0.05f, 0.05f, 0.05f);

            var textMesh = textObj.AddComponent<TextMesh>();
            textMesh.text = "You may refresh any number of tiles.";
            textMesh.fontSize = 100;
            textMesh.characterSize = 0.5f;
            textMesh.alignment = TextAlignment.Center;
            textMesh.anchor = TextAnchor.MiddleCenter;
            textMesh.color = Color.white;

            _cyclePromptText = textObj;
            _cyclePromptText.SetActive(false);
        }

        private void OnDestroy()
        {
            if (GameManager.Instance != null)
            {
                GameManager.Instance.OnGameStateChanged -= RefreshHand;
                GameManager.Instance.OnSelectionChanged -= OnSelectionChanged;
            }
        }

        private void Update()
        {
            // Handle toggle lerp
            if (_isLerping)
            {
                _lerpTime += Time.deltaTime;
                float t = Mathf.Clamp01(_lerpTime / toggleDuration);
                t = t * t * (3f - 2f * t); // Smooth step

                _handAnchor.localPosition = Vector3.Lerp(_lerpStart, _lerpTarget, t);

                if (t >= 1f)
                {
                    _isLerping = false;
                }
            }
        }

        /// <summary>
        /// Toggle hand visibility (up/down).
        /// </summary>
        public void ToggleHand()
        {
            _isUp = !_isUp;
            _lerpStart = _handAnchor.localPosition;
            _lerpTarget = _isUp ? handUpPosition : handDownPosition;
            _lerpTime = 0f;
            _isLerping = true;
        }

        private void CreateConfirmButton()
        {
            _confirmButton = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            _confirmButton.transform.SetParent(_handAnchor);
            _confirmButton.transform.localPosition = confirmButtonOffset;
            _confirmButton.transform.localRotation = Quaternion.Euler(90f, 0f, 0f);
            _confirmButton.transform.localScale = new Vector3(buttonSize, 0.05f, buttonSize);
            _confirmButton.name = "ConfirmButton";

            if (confirmMaterial != null)
            {
                _confirmButton.GetComponent<Renderer>().material = confirmMaterial;
            }

            // Add click handler
            var handler = _confirmButton.AddComponent<ConfirmButtonClickHandler>();
            handler.Controller = this;

            // Add text label
            GameObject textObj = new GameObject("Label");
            textObj.transform.SetParent(_confirmButton.transform);
            textObj.transform.localPosition = new Vector3(0f, 0.6f, 0f);
            textObj.transform.localRotation = Quaternion.Euler(90f, 0f, 0f);
            textObj.transform.localScale = new Vector3(0.15f, 0.15f, 0.15f);

            var textMesh = textObj.AddComponent<TextMesh>();
            textMesh.text = "OK";
            textMesh.fontSize = 32;
            textMesh.alignment = TextAlignment.Center;
            textMesh.anchor = TextAnchor.MiddleCenter;
            textMesh.color = Color.black;

            _confirmButton.SetActive(false);
            _confirmVisible = false;
        }

        private void CreateCancelButton()
        {
            _cancelButton = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            _cancelButton.transform.SetParent(_handAnchor);
            _cancelButton.transform.localPosition = cancelButtonOffset;
            _cancelButton.transform.localRotation = Quaternion.Euler(90f, 0f, 0f);
            _cancelButton.transform.localScale = new Vector3(buttonSize, 0.05f, buttonSize);
            _cancelButton.name = "CancelButton";

            if (cancelMaterial != null)
            {
                _cancelButton.GetComponent<Renderer>().material = cancelMaterial;
            }

            // Add click handler
            var handler = _cancelButton.AddComponent<CancelButtonClickHandler>();
            handler.Controller = this;

            // Add text label
            GameObject textObj = new GameObject("Label");
            textObj.transform.SetParent(_cancelButton.transform);
            textObj.transform.localPosition = new Vector3(0f, 0.6f, 0f);
            textObj.transform.localRotation = Quaternion.Euler(90f, 0f, 0f);
            textObj.transform.localScale = new Vector3(0.15f, 0.15f, 0.15f);

            var textMesh = textObj.AddComponent<TextMesh>();
            textMesh.text = "X";
            textMesh.fontSize = 32;
            textMesh.alignment = TextAlignment.Center;
            textMesh.anchor = TextAnchor.MiddleCenter;
            textMesh.color = Color.black;

            _cancelButton.SetActive(false);
        }

        /// <summary>
        /// Rebuild hand tiles from current player's hand.
        /// </summary>
        public void RefreshHand()
        {
            Debug.Log($"RefreshHand called. IsInCycleMode: {_isInCycleMode}");

            if (GameManager.Instance?.GameState == null) return;

            var state = GameManager.Instance.GameState;
            var hand = state.Hands[state.CurrentPlayer];

            // Clear old tiles
            foreach (var obj in _handTileObjects)
            {
                Destroy(obj);
            }
            _handTileObjects.Clear();
            _currentHand.Clear();
            _selectedIndex = -1;

            // Create new tiles
            float totalWidth = (hand.Count - 1) * tileSpacing;
            float startX = -totalWidth / 2f;

            for (int i = 0; i < hand.Count; i++)
            {
                char letter = hand[i];
                _currentHand.Add(letter);

                Vector3 localPos = new Vector3(startX + i * tileSpacing, 0f, 0f);
                GameObject tileObj = CreateHandTile(letter, localPos, i);
                _handTileObjects.Add(tileObj);
            }
        }

        private GameObject CreateHandTile(char letter, Vector3 localPos, int index)
        {
            // Create cylinder as hex placeholder
            GameObject tile = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            tile.transform.SetParent(_handAnchor);
            tile.transform.localPosition = localPos;
            tile.transform.localRotation = Quaternion.Euler(90f, 0f, 0f); // Flat
            tile.transform.localScale = new Vector3(tileSize, 0.05f, tileSize);
            tile.GetComponent<Renderer>().shadowCastingMode = ShadowCastingMode.Off;

            // Set material based on current player
            var state = GameManager.Instance.GameState;
            Material mat = state.CurrentPlayer == Player.Yellow ? yellowTileMaterial : blueTileMaterial;
            if (mat != null)
            {
                tile.GetComponent<Renderer>().material = mat;
            }

            tile.name = $"HandTile_{letter}_{index}";

            // Add click handler
            var handler = tile.AddComponent<HandTileClickHandler>();
            handler.Controller = this;
            handler.Index = index;
            handler.Letter = letter;

            // Add 3D text for letter (placeholder)
            CreateLetterText(tile, letter);

            return tile;
        }

        private void CreateLetterText(GameObject tile, char letter)
        {
            GameObject textObj = new GameObject("Letter");
            textObj.transform.SetParent(tile.transform);
            textObj.transform.localPosition = new Vector3(0f, 0.6f, 0f);
            textObj.transform.localRotation = Quaternion.Euler(90f, 0f, 0f);

            // Scale down but use large font size for crisp text
            textObj.transform.localScale = new Vector3(0.05f, 0.05f, 0.05f);

            var textMesh = textObj.AddComponent<TextMesh>();
            textMesh.text = letter.ToString();
            textMesh.fontSize = 100;
            textMesh.characterSize = 1.5f;
            textMesh.alignment = TextAlignment.Center;
            textMesh.anchor = TextAnchor.MiddleCenter;
            textMesh.color = Color.black;
        }

        /// <summary>
        /// Called when a hand tile is clicked.
        /// </summary>
        public void OnTileClicked(int index, char letter)
        {
            // Handle cycle mode selection
            if (_isInCycleMode)
            {
                ToggleTileForDiscard(index);
                return;
            }

            // Only allow selection when we're in cast position selection phase
            if (GameManager.Instance.PendingCastPosition == null)
            {
                Debug.Log("Choose a cast position first!");
                return;
            }

            _selectedIndex = index;
            UpdateTileHighlights();

            Debug.Log($"Selected letter: {letter}");
            GameManager.Instance.SelectLetter(letter);
            ShowConfirmButton();
            ShowCancelButton();
        }

        private void UpdateTileHighlights()
        {
            for (int i = 0; i < _handTileObjects.Count; i++)
            {
                var renderer = _handTileObjects[i].GetComponent<Renderer>();
                if (renderer == null) continue;

                if (i == _selectedIndex && selectedMaterial != null)
                {
                    renderer.material = selectedMaterial;
                }
                else
                {
                    var state = GameManager.Instance.GameState;
                    Material mat = state.CurrentPlayer == Player.Yellow ? yellowTileMaterial : blueTileMaterial;
                    if (mat != null)
                    {
                        renderer.material = mat;
                    }
                }
            }
        }

        private void OnSelectionChanged()
        {
            // Check if we entered cycle mode
            if (GameManager.Instance.IsInCycleMode && !_isInCycleMode)
            {
                EnterCycleMode();
                return;
            }

            // If in cycle mode, don't do normal selection logic
            if (_isInCycleMode)
            {
                return;
            }

            // If selection was cleared, reset highlights and buttons
            if (GameManager.Instance.SelectedGlyphling == null)
            {
                _selectedIndex = -1;
                UpdateTileHighlights();
                HideConfirmButton();
                HideCancelButton();
            }
            // If we have a pending destination, show cancel button
            else if (GameManager.Instance.PendingDestination != null)
            {
                ShowCancelButton();
            }
        }
        private void EnterCycleMode()
        {
            Debug.Log("EnterCycleMode called!");
            _isInCycleMode = true;
            _selectedForDiscard.Clear();

            // Show prompt and OK button
            _cyclePromptText.SetActive(true);
            Debug.Log($"Confirm button before show: {_confirmButton.activeSelf}");
            ShowConfirmButton();
            Debug.Log($"Confirm button after show: {_confirmButton.activeSelf}");
            HideCancelButton();

            Debug.Log("Entered cycle mode - select tiles to discard");
        }
        private void ToggleTileForDiscard(int index)
        {
            if (_selectedForDiscard.Contains(index))
            {
                // Deselect - scale and move back down
                _selectedForDiscard.Remove(index);
                var tile = _handTileObjects[index];
                tile.transform.localPosition += new Vector3(0f, 0.3f, 0f);
                tile.transform.localScale = new Vector3(tileSize, 0.05f, tileSize);
            }
            else
            {
                // Select - scale up and move up
                _selectedForDiscard.Add(index);
                var tile = _handTileObjects[index];
                tile.transform.localPosition -= new Vector3(0f, 0.3f, 0f);
                tile.transform.localScale = new Vector3(tileSize * 1.2f, 0.05f, tileSize * 1.2f);
            }

            Debug.Log($"Tiles selected for discard: {_selectedForDiscard.Count}");
        }

        public void ShowConfirmButton()
        {
            _confirmButton.SetActive(true);
            _confirmVisible = true;
        }

        public void HideConfirmButton()
        {
            _confirmButton.SetActive(false);
            _confirmVisible = false;
        }
        public void ShowCancelButton()
        {
            _cancelButton.SetActive(true);
        }

        public void HideCancelButton()
        {
            _cancelButton.SetActive(false);
        }

        public void OnConfirmClicked()
        {
            // Handle cycle mode confirmation
            if (_isInCycleMode)
            {
                ConfirmCycleDiscard();
                return;
            }

            if (GameManager.Instance.PendingLetter != null)
            {
                GameManager.Instance.ConfirmMove();

                // Only hide buttons if we didn't enter cycle mode
                if (!GameManager.Instance.IsInCycleMode)
                {
                    HideConfirmButton();
                    HideCancelButton();
                }
            }
        }
        public void OnCancelClicked()
        {
            GameManager.Instance.ResetMove();
            HideCancelButton();
            HideConfirmButton();
        }

        private void ConfirmCycleDiscard()
        {
            // Get the tiles to discard
            var state = GameManager.Instance.GameState;
            var hand = state.Hands[state.CurrentPlayer];
            var toDiscard = new List<char>();

            foreach (int index in _selectedForDiscard)
            {
                toDiscard.Add(_currentHand[index]);
            }

            // Remove discarded tiles from hand
            foreach (char letter in toDiscard)
            {
                hand.Remove(letter);
            }

            // Draw back up to 8 tiles
            while (hand.Count < GameRules.HandSize && state.TileBag.Count > 0)
            {
                GameRules.DrawTile(state, state.CurrentPlayer);
            }

            Debug.Log($"Discarded {toDiscard.Count} tiles, drew back up to {hand.Count}");

            // Exit cycle mode
            ExitCycleMode();

            // End the turn
            GameManager.Instance.EndCycleMode();
        }
        private void ExitCycleMode()
        {
            _isInCycleMode = false;
            _selectedForDiscard.Clear();
            _cyclePromptText.SetActive(false);
            HideConfirmButton();
        }
    }

    /// <summary>
    /// Handles clicks on hand tiles.
    /// </summary>
    public class HandTileClickHandler : MonoBehaviour
    {
        public HandController Controller { get; set; }
        public int Index { get; set; }
        public char Letter { get; set; }

        private void OnMouseDown()
        {
            Controller?.OnTileClicked(Index, Letter);
        }
    }

    /// <summary>
    /// Handles clicks on confirm button.
    /// </summary>
    public class ConfirmButtonClickHandler : MonoBehaviour
    {
        public HandController Controller { get; set; }

        private void OnMouseDown()
        {
            Controller?.OnConfirmClicked();
        }
    }

    /// <summary>
    /// Handles clicks on cancel button.
    /// </summary>
    public class CancelButtonClickHandler : MonoBehaviour
    {
        public HandController Controller { get; set; }

        private void OnMouseDown()
        {
            Controller?.OnCancelClicked();
        }
    }
}