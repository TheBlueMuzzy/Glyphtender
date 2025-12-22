using UnityEngine;
using Glyphtender.Core;
using System.Collections.Generic;
using UnityEngine.Rendering;

namespace Glyphtender.Unity
{
    public enum DockPosition
    {
        Bottom,
        Left,
        Right
    }

    /// <summary>
    /// Configuration for a specific dock position and orientation.
    /// </summary>
    public struct DockConfig
    {
        public Vector3 handUpPosition;
        public Vector3 handDownPosition;
        public Quaternion handRotation;
        public float tileSize;
        public float tileSpacing;
        public float buttonSize;
        public Vector3 inputModeButtonOffset;
        public bool isVerticalLayout;
    }

    /// <summary>
    /// Manages the player's hand of tiles in 3D space.
    /// Attached to camera so it follows the view.
    /// </summary>
    public class HandController : MonoBehaviour
    {
        [Header("Dock Settings")]
        public DockPosition currentDock = DockPosition.Bottom;

        [Header("Layout")]
        public float tileSpacing = 1.2f;
        public float tileSize = 0.8f;

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

        // Dock configurations
        private DockConfig _currentConfig;

        // State
        private float _lastAspect;
        private bool _lastIsPortrait;
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
        private Transform _buttonAnchor;

        // Confirm Button
        private GameObject _confirmButton;
        private bool _confirmVisible;

        // Cancel Button
        private GameObject _cancelButton;

        // Replay Button
        private GameObject _replayButton;

        // Input Mode Toggle Button
        private GameObject _inputModeButton;
        private TextMesh _inputModeText;

        // Cycle mode
        private bool _isInCycleMode;
        private HashSet<int> _selectedForDiscard = new HashSet<int>();
        private GameObject _cyclePromptText;

        private void Start()
        {
            // Create anchor as child of camera
            _handAnchor = new GameObject("HandAnchor").transform;
            _handAnchor.SetParent(Camera.main.transform);

            // Create separate anchor for buttons (always bottom right)
            _buttonAnchor = new GameObject("ButtonAnchor").transform;
            _buttonAnchor.SetParent(Camera.main.transform);
            _buttonAnchor.localRotation = Quaternion.Euler(180f, 0f, 0f);

            if (GameManager.Instance != null)
            {
                GameManager.Instance.OnGameStateChanged += RefreshHand;
                GameManager.Instance.OnSelectionChanged += OnSelectionChanged;
                GameManager.Instance.OnGameEnded += OnGameEnded;
                GameManager.Instance.OnGameRestarted += OnGameRestarted;
            }

            CreateConfirmButton();
            CreateCancelButton();
            CreateCyclePrompt();
            CreateReplayButton();
            CreateInputModeButton();

            ApplyDockConfig();

            RefreshHand();
        }

        private void ApplyDockConfig()
        {
            bool isPortrait = Screen.height > Screen.width;
            Camera cam = Camera.main;

            // Get camera bounds in world space
            float camHeight = cam.orthographicSize * 2f;
            float camWidth = camHeight * cam.aspect;
            float handDistance = 6f;

            if (isPortrait)
            {
                tileSize = 0.6f;
                tileSpacing = 0.8f;
                buttonSize = 0.5f;
            }
            else
            {
                tileSize = 0.8f;
                tileSpacing = 1.2f;
                buttonSize = 0.6f;
            }

            switch (currentDock)
            {
                case DockPosition.Bottom:
                    float bottomEdge;
                    if (isPortrait)
                    {
                        bottomEdge = cam.orthographicSize * 0.9f;
                    }
                    else
                    {
                        bottomEdge = cam.orthographicSize - 1.0f;
                    }

                    _currentConfig = new DockConfig
                    {
                        handUpPosition = new Vector3(0f, -bottomEdge, handDistance),
                        handDownPosition = new Vector3(0f, -bottomEdge - 1.5f, handDistance),
                        handRotation = Quaternion.Euler(180f, 0f, 0f),
                        tileSize = tileSize,
                        tileSpacing = tileSpacing,
                        buttonSize = buttonSize,
                        inputModeButtonOffset = new Vector3(-5f, 0f, 0f),
                        isVerticalLayout = false
                    };
                    break;

                case DockPosition.Left:
                    float leftEdge;
                    if (isPortrait)
                    {
                        leftEdge = cam.orthographicSize * cam.aspect * 0.9f;
                    }
                    else
                    {
                        leftEdge = cam.orthographicSize * cam.aspect - 1.0f;
                    }

                    _currentConfig = new DockConfig
                    {
                        handUpPosition = new Vector3(-leftEdge, 0f, handDistance),
                        handDownPosition = new Vector3(-leftEdge - 1.5f, 0f, handDistance),
                        handRotation = Quaternion.Euler(180f, 0f, 90f),
                        tileSize = tileSize,
                        tileSpacing = tileSpacing,
                        buttonSize = buttonSize,
                        inputModeButtonOffset = new Vector3(0f, -5f, 0f),
                        isVerticalLayout = true
                    };
                    break;

                case DockPosition.Right:
                    float rightEdge;
                    if (isPortrait)
                    {
                        rightEdge = cam.orthographicSize * cam.aspect * 0.9f;
                    }
                    else
                    {
                        rightEdge = cam.orthographicSize * cam.aspect - 1.0f;
                    }

                    _currentConfig = new DockConfig
                    {
                        handUpPosition = new Vector3(rightEdge, 0f, handDistance),
                        handDownPosition = new Vector3(rightEdge + 1.5f, 0f, handDistance),
                        handRotation = Quaternion.Euler(180f, 0f, -90f),
                        tileSize = tileSize,
                        tileSpacing = tileSpacing,
                        buttonSize = buttonSize,
                        inputModeButtonOffset = new Vector3(0f, 5f, 0f),
                        isVerticalLayout = true
                    };
                    break;
            }

            // Apply hand configuration
            _handAnchor.localPosition = _currentConfig.handUpPosition;
            _handAnchor.localRotation = _currentConfig.handRotation;

            // Position buttons in bottom right corner (fixed position)
            float buttonBottomOffset = cam.orthographicSize - 1.5f;
            float buttonRightOffset = cam.orthographicSize * cam.aspect - 1.5f;
            _buttonAnchor.localPosition = new Vector3(buttonRightOffset, -buttonBottomOffset, handDistance);

            // Update button positions relative to button anchor
            if (_confirmButton != null)
            {
                _confirmButton.transform.localPosition = new Vector3(-1.2f, 0f, 0f);
                _confirmButton.transform.localScale = new Vector3(buttonSize, 0.05f, buttonSize);
            }
            if (_cancelButton != null)
            {
                _cancelButton.transform.localPosition = new Vector3(0.2f, 0f, 0f);
                _cancelButton.transform.localScale = new Vector3(buttonSize, 0.05f, buttonSize);
            }

            // Update input mode button position
            if (_inputModeButton != null)
            {
                _inputModeButton.transform.localPosition = _currentConfig.inputModeButtonOffset;
                _inputModeButton.transform.localScale = new Vector3(buttonSize * 1.2f, 0.05f, buttonSize * 1.2f);
            }

            // Refresh hand with new tile sizes
            RefreshHand();

            Debug.Log($"Dock applied: {currentDock}, Portrait: {isPortrait}, CamSize: {cam.orthographicSize}");
        }

        /// <summary>
        /// Changes the dock position.
        /// </summary>
        public void SetDockPosition(DockPosition dock)
        {
            currentDock = dock;
            ApplyDockConfig();
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
                GameManager.Instance.OnGameEnded -= OnGameEnded;
                GameManager.Instance.OnGameRestarted -= OnGameRestarted;
            }
        }

        private void CreateReplayButton()
        {
            _replayButton = CreateButton(
                parent: _handAnchor,
                name: "ReplayButton",
                scale: new Vector3(1f, 0.05f, 1f),
                material: confirmMaterial,
                labelText: "REPLAY",
                labelScale: new Vector3(0.025f, 0.025f, 0.025f),
                fontSize: 100,
                characterSize: 1f,
                onClick: OnReplayClicked,
                textMesh: out _
            );

            _replayButton.SetActive(false);
        }

        private void CreateInputModeButton()
        {
            // Create gray material for this button
            Material grayMaterial = new Material(Shader.Find("Standard"));
            grayMaterial.color = new Color(0.7f, 0.7f, 0.7f);

            _inputModeButton = CreateButton(
                parent: _handAnchor,
                name: "InputModeButton",
                scale: new Vector3(0.8f, 0.05f, 0.8f),
                material: grayMaterial,
                labelText: "TAP",
                labelScale: new Vector3(0.05f, 0.05f, 0.05f),
                fontSize: 100,
                characterSize: 0.5f,
                onClick: OnInputModeClicked,
                textMesh: out _inputModeText
            );

            _inputModeButton.transform.localPosition = new Vector3(-5f, 0f, 0f);
        }

        public void OnInputModeClicked()
        {
            if (GameManager.Instance.CurrentInputMode == GameManager.InputMode.Tap)
            {
                GameManager.Instance.SetInputMode(GameManager.InputMode.Drag);
                _inputModeText.text = "DRAG";
            }
            else
            {
                GameManager.Instance.SetInputMode(GameManager.InputMode.Tap);
                _inputModeText.text = "TAP";
            }
        }

        private void OnGameEnded(Player? winner)
        {
            // Hide all hand tiles
            foreach (var tile in _handTileObjects)
            {
                tile.SetActive(false);
            }

            // Hide buttons
            HideConfirmButton();
            HideCancelButton();
            _cyclePromptText.SetActive(false);

            // Show replay button
            _replayButton.SetActive(true);
        }

        private void OnGameRestarted()
        {
            // Reset cycle mode
            _isInCycleMode = false;
            _selectedForDiscard.Clear();
            _cyclePromptText.SetActive(false);

            // Hide replay button
            _replayButton.SetActive(false);

            // Show hand tiles again
            foreach (var tile in _handTileObjects)
            {
                tile.SetActive(true);
            }

            // Refresh hand
            RefreshHand();
        }

        public void OnReplayClicked()
        {
            // Hide replay button
            _replayButton.SetActive(false);

            // Restart game
            GameManager.Instance.InitializeGame();
        }

        private void Update()
        {
            // Check for aspect ratio changes
            bool isPortrait = Screen.height > Screen.width;
            if (Mathf.Abs(Camera.main.aspect - _lastAspect) > 0.01f || isPortrait != _lastIsPortrait)
            {
                _lastAspect = Camera.main.aspect;
                _lastIsPortrait = isPortrait;
                ApplyDockConfig();
            }

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

            // Debug: Press D to cycle dock positions
            if (Input.GetKeyDown(KeyCode.D))
            {
                switch (currentDock)
                {
                    case DockPosition.Bottom:
                        SetDockPosition(DockPosition.Left);
                        break;
                    case DockPosition.Left:
                        SetDockPosition(DockPosition.Right);
                        break;
                    case DockPosition.Right:
                        SetDockPosition(DockPosition.Bottom);
                        break;
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
            _lerpTarget = _isUp ? _currentConfig.handUpPosition : _currentConfig.handDownPosition;
            _lerpTime = 0f;
            _isLerping = true;
        }

        /// <summary>
        /// Creates a cylindrical button with a text label.
        /// </summary>
        private GameObject CreateButton(
            Transform parent,
            string name,
            Vector3 scale,
            Material material,
            string labelText,
            Vector3 labelScale,
            int fontSize,
            float characterSize,
            System.Action onClick,
            out TextMesh textMesh)
        {
            GameObject button = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            button.transform.SetParent(parent);
            button.transform.localPosition = Vector3.zero;
            button.transform.localRotation = Quaternion.Euler(90f, 0f, 0f);
            button.transform.localScale = scale;
            button.name = name;
            button.GetComponent<Renderer>().shadowCastingMode = ShadowCastingMode.Off;

            if (material != null)
            {
                button.GetComponent<Renderer>().material = material;
            }

            // Add click handler
            var handler = button.AddComponent<ButtonClickHandler>();
            handler.Initialize(onClick);

            // Add text label
            GameObject textObj = new GameObject("Label");
            textObj.transform.SetParent(button.transform);
            textObj.transform.localPosition = new Vector3(0f, 0.6f, 0f);
            textObj.transform.localRotation = Quaternion.Euler(90f, 0f, 0f);
            textObj.transform.localScale = labelScale;

            textMesh = textObj.AddComponent<TextMesh>();
            textMesh.text = labelText;
            textMesh.fontSize = fontSize;
            textMesh.characterSize = characterSize;
            textMesh.alignment = TextAlignment.Center;
            textMesh.anchor = TextAnchor.MiddleCenter;
            textMesh.color = Color.black;

            return button;
        }

        private void CreateConfirmButton()
        {
            _confirmButton = CreateButton(
                parent: _buttonAnchor,
                name: "ConfirmButton",
                scale: new Vector3(buttonSize, 0.05f, buttonSize),
                material: confirmMaterial,
                labelText: "OK",
                labelScale: new Vector3(0.15f, 0.15f, 0.15f),
                fontSize: 32,
                characterSize: 1f,
                onClick: OnConfirmClicked,
                textMesh: out _
            );

            _confirmButton.SetActive(false);
            _confirmVisible = false;
        }

        private void CreateCancelButton()
        {
            _cancelButton = CreateButton(
                parent: _buttonAnchor,
                name: "CancelButton",
                scale: new Vector3(buttonSize, 0.05f, buttonSize),
                material: cancelMaterial,
                labelText: "X",
                labelScale: new Vector3(0.15f, 0.15f, 0.15f),
                fontSize: 32,
                characterSize: 1f,
                onClick: OnCancelClicked,
                textMesh: out _
            );

            _cancelButton.SetActive(false);
        }

        /// <summary>
        /// Rebuild hand tiles from current player's hand.
        /// </summary>
        public void RefreshHand()
        {
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
            var clickHandler = tile.AddComponent<HandTileClickHandler>();
            clickHandler.Controller = this;
            clickHandler.Index = index;
            clickHandler.Letter = letter;

            // Add drag handler
            var dragHandler = tile.AddComponent<HandTileDragHandler>();
            dragHandler.Controller = this;
            dragHandler.Index = index;
            dragHandler.Letter = letter;

            // Add 3D text for letter
            CreateLetterText(tile, letter);

            return tile;
        }

        private void CreateLetterText(GameObject tile, char letter)
        {
            GameObject textObj = new GameObject("Letter");
            textObj.transform.SetParent(tile.transform);
            textObj.transform.localPosition = new Vector3(0f, 0.6f, 0f);

            // Rotate to face camera, accounting for dock rotation
            if (currentDock == DockPosition.Left)
            {
                textObj.transform.localRotation = Quaternion.Euler(90f, -90f, 0f);
            }
            else if (currentDock == DockPosition.Right)
            {
                textObj.transform.localRotation = Quaternion.Euler(90f, 90f, 0f);
            }
            else
            {
                textObj.transform.localRotation = Quaternion.Euler(90f, 0f, 0f);
            }

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

            // Only allow selection after moving the glyphling
            if (GameManager.Instance.PendingDestination == null)
            {
                Debug.Log("Move your glyphling first!");
                return;
            }

            _selectedIndex = index;
            UpdateTileHighlights();

            Debug.Log($"Selected letter: {letter}");
            GameManager.Instance.SelectLetter(letter);

            // Show confirm button only if both letter and cast position are selected
            if (GameManager.Instance.PendingCastPosition != null)
            {
                ShowConfirmButton();
            }
            ShowCancelButton();
        }

        /// <summary>
        /// Sets the selected tile index (used by drag handler).
        /// </summary>
        public void SetSelectedIndex(int index)
        {
            _selectedIndex = index;
            UpdateTileHighlights();
        }

        /// <summary>
        /// Clears the selected tile index.
        /// </summary>
        public void ClearSelectedIndex()
        {
            _selectedIndex = -1;
            UpdateTileHighlights();
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

                // Show confirm if both cast position and letter are selected
                if (GameManager.Instance.PendingCastPosition != null &&
                    GameManager.Instance.PendingLetter != null)
                {
                    ShowConfirmButton();
                }
            }
        }

        private void EnterCycleMode()
        {
            _isInCycleMode = true;
            _selectedForDiscard.Clear();

            // Show prompt and OK button
            _cyclePromptText.SetActive(true);
            ShowConfirmButton();
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
            // Always allow in cycle mode, otherwise only in tap mode
            if (!GameManager.Instance.IsInCycleMode &&
                GameManager.Instance.CurrentInputMode != GameManager.InputMode.Tap)
                return;

            Controller?.OnTileClicked(Index, Letter);
        }
    }

    /// <summary>
    /// Generic click handler for buttons. Takes a callback action.
    /// </summary>
    public class ButtonClickHandler : MonoBehaviour
    {
        private System.Action _onClick;

        public void Initialize(System.Action onClick)
        {
            _onClick = onClick;
        }

        private void OnMouseDown()
        {
            _onClick?.Invoke();
        }
    }
}
