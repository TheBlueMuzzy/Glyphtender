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
        public bool isVerticalLayout;
    }

    /// <summary>
    /// Manages the player's hand of tiles in 3D space.
    /// Attached to UI camera so it stays fixed during board zoom/pan.
    /// </summary>
    public class HandController : MonoBehaviour
    {
        [Header("Camera")]
        public Camera uiCamera;  // Reference to UI camera (set in inspector or auto-found)

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
        public float buttonSize = 0.75f;

        [Header("Input Mode Button (anchored to top-right corner)")]
        public float inputModeFromRight = 1.0f;   // Units from right edge
        public float inputModeFromTop = 1.0f;     // Units from top edge

        [Header("Confirm Button (anchored to bottom-right corner)")]
        public float confirmFromRight = 1.0f;     // Units from right edge
        public float confirmFromBottom = 1.75f;   // Units from bottom edge

        [Header("Cancel Button (anchored to bottom-right corner)")]
        public float cancelFromRight = 1.0f;      // Units from right edge
        public float cancelFromBottom = 3.0f;     // Units from bottom edge

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

        // Anchors - separate for hand tiles vs UI elements
        private Transform _handAnchor;      // Moves/rotates with dock position
        private Transform _uiAnchor;        // Fixed, children position relative to screen edges

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

        private float _handDistance = 6f;

        private void Start()
        {
            // Find UI camera if not set
            if (uiCamera == null)
            {
                uiCamera = GetComponentInParent<Camera>();

                if (uiCamera == null)
                {
                    var uiCamObj = GameObject.Find("UICamera");
                    if (uiCamObj != null)
                    {
                        uiCamera = uiCamObj.GetComponent<Camera>();
                    }
                }

                if (uiCamera == null)
                {
                    Debug.LogError("HandController: No UI camera found!");
                    return;
                }
            }

            // Create hand anchor (for tiles - moves with dock)
            _handAnchor = new GameObject("HandAnchor").transform;
            _handAnchor.SetParent(uiCamera.transform);

            // Create UI anchor (for buttons - fixed, children edge-anchor themselves)
            _uiAnchor = new GameObject("UIAnchor").transform;
            _uiAnchor.SetParent(uiCamera.transform);
            _uiAnchor.localPosition = new Vector3(0f, 0f, _handDistance);
            _uiAnchor.localRotation = Quaternion.Euler(180f, 0f, 0f);

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
            PositionUIElements();

            RefreshHand();
        }

        private void Update()
        {
            if (uiCamera == null) return;

            // Check for aspect ratio changes
            bool isPortrait = Screen.height > Screen.width;
            if (Mathf.Abs(uiCamera.aspect - _lastAspect) > 0.01f || isPortrait != _lastIsPortrait)
            {
                _lastAspect = uiCamera.aspect;
                _lastIsPortrait = isPortrait;
                ApplyDockConfig();
                PositionUIElements();
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
        /// Positions UI elements (buttons) relative to screen corners.
        /// Each button is anchored to a corner and offset inward from there.
        /// </summary>
        private void PositionUIElements()
        {
            if (uiCamera == null) return;

            // Screen bounds (half-sizes from center)
            float halfHeight = uiCamera.orthographicSize;
            float halfWidth = halfHeight * uiCamera.aspect;

            // Corner positions
            // Note: _uiAnchor is rotated 180° on X, so Y is flipped
            //   Top of screen = negative Y
            //   Bottom of screen = positive Y
            //   Right side = positive X
            //   Left side = negative X

            float rightEdge = halfWidth;
            float leftEdge = -halfWidth;
            float topEdge = -halfHeight;      // Flipped due to rotation
            float bottomEdge = halfHeight;    // Flipped due to rotation

            // Input Mode Button: anchored to top-right corner
            // Offset moves it LEFT (subtract from X) and DOWN (add to Y)
            if (_inputModeButton != null)
            {
                float x = rightEdge - inputModeFromRight;
                float y = topEdge + inputModeFromTop;
                _inputModeButton.transform.localPosition = new Vector3(x, y, 0f);
            }

            // Confirm Button: anchored to bottom-right corner
            // Offset moves it LEFT (subtract from X) and UP (subtract from Y)
            if (_confirmButton != null)
            {
                float x = rightEdge - confirmFromRight;
                float y = bottomEdge - confirmFromBottom;
                _confirmButton.transform.localPosition = new Vector3(x, y, 0f);
            }

            // Cancel Button: anchored to bottom-right corner
            // Offset moves it LEFT (subtract from X) and UP (subtract from Y)
            if (_cancelButton != null)
            {
                float x = rightEdge - cancelFromRight;
                float y = bottomEdge - cancelFromBottom;
                _cancelButton.transform.localPosition = new Vector3(x, y, 0f);
            }

            // Replay Button: centered on screen
            if (_replayButton != null)
            {
                _replayButton.transform.localPosition = new Vector3(0f, 0f, 0f);
            }
        }

        private void ApplyDockConfig()
        {
            if (uiCamera == null) return;

            bool isPortrait = Screen.height > Screen.width;

            float camHeight = uiCamera.orthographicSize;
            float camWidth = camHeight * uiCamera.aspect;

            // tileSize and tileSpacing are now set via Inspector
            // (no longer overwritten here)

            switch (currentDock)
            {
                case DockPosition.Bottom:
                    float bottomEdge = camHeight - 1.0f;

                    _currentConfig = new DockConfig
                    {
                        handUpPosition = new Vector3(0f, -bottomEdge, _handDistance),
                        handDownPosition = new Vector3(0f, -bottomEdge - 1.5f, _handDistance),
                        handRotation = Quaternion.Euler(180f, 0f, 0f),
                        tileSize = tileSize,
                        tileSpacing = tileSpacing,
                        isVerticalLayout = false
                    };
                    break;

                case DockPosition.Left:
                    float leftEdge = camWidth - 1.0f;

                    _currentConfig = new DockConfig
                    {
                        handUpPosition = new Vector3(-leftEdge, 0f, _handDistance),
                        handDownPosition = new Vector3(-leftEdge - 1.5f, 0f, _handDistance),
                        handRotation = Quaternion.Euler(180f, 0f, 90f),
                        tileSize = tileSize,
                        tileSpacing = tileSpacing,
                        isVerticalLayout = true
                    };
                    break;

                case DockPosition.Right:
                    float rightEdge = camWidth - 1.0f;

                    _currentConfig = new DockConfig
                    {
                        handUpPosition = new Vector3(rightEdge, 0f, _handDistance),
                        handDownPosition = new Vector3(rightEdge + 1.5f, 0f, _handDistance),
                        handRotation = Quaternion.Euler(180f, 0f, -90f),
                        tileSize = tileSize,
                        tileSpacing = tileSpacing,
                        isVerticalLayout = true
                    };
                    break;
            }

            // Apply hand configuration only
            _handAnchor.localPosition = _currentConfig.handUpPosition;
            _handAnchor.localRotation = _currentConfig.handRotation;

            // Update cycle prompt position (relative to hand)
            if (_cyclePromptText != null)
            {
                _cyclePromptText.transform.localPosition = new Vector3(0f, -1f, 0f);
            }

            // Refresh hand with new tile sizes
            RefreshHand();

            Debug.Log($"Dock applied: {currentDock}, Portrait: {isPortrait}, CamSize: {uiCamera.orthographicSize}");
        }

        /// <summary>
        /// Changes the dock position.
        /// </summary>
        public void SetDockPosition(DockPosition dock)
        {
            currentDock = dock;
            ApplyDockConfig();
            // Note: PositionUIElements is NOT called here - buttons stay put
        }

        private void CreateCyclePrompt()
        {
            GameObject textObj = new GameObject("CyclePrompt");
            textObj.transform.SetParent(_handAnchor);
            textObj.transform.localPosition = new Vector3(0f, -1f, 0f);
            textObj.transform.localRotation = Quaternion.Euler(180f, 0f, 0f);
            textObj.transform.localScale = new Vector3(0.05f, 0.05f, 0.05f);
            textObj.layer = LayerMask.NameToLayer("UI3D");

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
                parent: _uiAnchor,
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

            _replayButton.transform.localPosition = Vector3.zero;
            _replayButton.SetActive(false);
        }

        private void CreateInputModeButton()
        {
            Material grayMaterial = new Material(Shader.Find("Standard"));
            grayMaterial.color = new Color(0.7f, 0.7f, 0.7f);

            _inputModeButton = CreateButton(
                parent: _uiAnchor,
                name: "InputModeButton",
                scale: new Vector3(buttonSize, 0.05f, buttonSize),
                material: grayMaterial,
                labelText: "TAP",
                labelScale: new Vector3(0.05f, 0.05f, 0.05f),
                fontSize: 100,
                characterSize: 0.5f,
                onClick: OnInputModeClicked,
                textMesh: out _inputModeText
            );
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
            foreach (var tile in _handTileObjects)
            {
                tile.SetActive(false);
            }

            HideConfirmButton();
            HideCancelButton();
            _cyclePromptText.SetActive(false);

            _replayButton.SetActive(true);
        }

        private void OnGameRestarted()
        {
            _isInCycleMode = false;
            _selectedForDiscard.Clear();
            _cyclePromptText.SetActive(false);

            _replayButton.SetActive(false);

            foreach (var tile in _handTileObjects)
            {
                tile.SetActive(true);
            }

            RefreshHand();
        }

        public void OnReplayClicked()
        {
            _replayButton.SetActive(false);
            GameManager.Instance.InitializeGame();
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
            button.layer = LayerMask.NameToLayer("UI3D");

            if (material != null)
            {
                button.GetComponent<Renderer>().material = material;
            }

            var handler = button.AddComponent<ButtonClickHandler>();
            handler.Initialize(onClick);

            GameObject textObj = new GameObject("Label");
            textObj.transform.SetParent(button.transform);
            textObj.transform.localPosition = new Vector3(0f, 0.6f, 0f);
            textObj.transform.localRotation = Quaternion.Euler(90f, 0f, 0f);
            textObj.transform.localScale = labelScale;
            textObj.layer = LayerMask.NameToLayer("UI3D");

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
                parent: _uiAnchor,
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
                parent: _uiAnchor,
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

            foreach (var obj in _handTileObjects)
            {
                Destroy(obj);
            }
            _handTileObjects.Clear();
            _currentHand.Clear();
            _selectedIndex = -1;

            // Calculate effective spacing (may auto-fit in portrait bottom dock)
            float effectiveSpacing = GetEffectiveTileSpacing(hand.Count);

            float totalWidth = (hand.Count - 1) * effectiveSpacing;
            float startX = -totalWidth / 2f;

            for (int i = 0; i < hand.Count; i++)
            {
                char letter = hand[i];
                _currentHand.Add(letter);

                Vector3 localPos = new Vector3(startX + i * effectiveSpacing, 0f, 0f);
                GameObject tileObj = CreateHandTile(letter, localPos, i);
                _handTileObjects.Add(tileObj);
            }
        }

        /// <summary>
        /// Calculates effective tile spacing.
        /// In portrait mode with bottom dock, auto-fits to screen width.
        /// Otherwise uses the Inspector tileSpacing value.
        /// </summary>
        private float GetEffectiveTileSpacing(int tileCount)
        {
            // Only auto-fit for bottom dock in portrait mode
            bool isPortrait = Screen.height > Screen.width;
            if (currentDock != DockPosition.Bottom || !isPortrait)
            {
                return tileSpacing;
            }

            if (uiCamera == null || tileCount <= 1)
            {
                return tileSpacing;
            }

            // Calculate available width (camera width minus margins for tile radius on each side)
            float camWidth = uiCamera.orthographicSize * uiCamera.aspect * 2f;
            float margin = tileSize;  // Half tile on each side
            float availableWidth = camWidth - margin;

            // Calculate max spacing that fits all tiles
            float maxSpacing = availableWidth / (tileCount - 1);

            // Use the smaller of user's setting or auto-fit max
            return Mathf.Min(tileSpacing, maxSpacing);
        }

        private GameObject CreateHandTile(char letter, Vector3 localPos, int index)
        {
            GameObject tile = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            tile.transform.SetParent(_handAnchor);
            tile.transform.localPosition = localPos;
            tile.transform.localRotation = Quaternion.Euler(90f, 0f, 0f);
            tile.transform.localScale = new Vector3(tileSize, 0.05f, tileSize);
            tile.GetComponent<Renderer>().shadowCastingMode = ShadowCastingMode.Off;
            tile.layer = LayerMask.NameToLayer("UI3D");

            var state = GameManager.Instance.GameState;
            Material mat = state.CurrentPlayer == Player.Yellow ? yellowTileMaterial : blueTileMaterial;
            if (mat != null)
            {
                tile.GetComponent<Renderer>().material = mat;
            }

            tile.name = $"HandTile_{letter}_{index}";

            var clickHandler = tile.AddComponent<HandTileClickHandler>();
            clickHandler.Controller = this;
            clickHandler.Index = index;
            clickHandler.Letter = letter;

            var dragHandler = tile.AddComponent<HandTileDragHandler>();
            dragHandler.Controller = this;
            dragHandler.Index = index;
            dragHandler.Letter = letter;

            CreateLetterText(tile, letter);

            return tile;
        }

        private void CreateLetterText(GameObject tile, char letter)
        {
            GameObject textObj = new GameObject("Letter");
            textObj.transform.SetParent(tile.transform);
            textObj.transform.localPosition = new Vector3(0f, 0.6f, 0f);
            textObj.layer = LayerMask.NameToLayer("UI3D");

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
            if (_isInCycleMode)
            {
                ToggleTileForDiscard(index);
                return;
            }

            if (GameManager.Instance.PendingDestination == null)
            {
                Debug.Log("Move your glyphling first!");
                return;
            }

            _selectedIndex = index;
            UpdateTileHighlights();

            Debug.Log($"Selected letter: {letter}");
            GameManager.Instance.SelectLetter(letter);

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
            if (GameManager.Instance.IsInCycleMode && !_isInCycleMode)
            {
                EnterCycleMode();
                return;
            }

            if (_isInCycleMode)
            {
                return;
            }

            if (GameManager.Instance.SelectedGlyphling == null)
            {
                _selectedIndex = -1;
                UpdateTileHighlights();
                HideConfirmButton();
                HideCancelButton();
            }
            else if (GameManager.Instance.PendingDestination != null)
            {
                ShowCancelButton();

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

            _cyclePromptText.SetActive(true);
            ShowConfirmButton();
            HideCancelButton();

            Debug.Log("Entered cycle mode - select tiles to discard");
        }

        private void ToggleTileForDiscard(int index)
        {
            if (_selectedForDiscard.Contains(index))
            {
                _selectedForDiscard.Remove(index);
                var tile = _handTileObjects[index];
                tile.transform.localPosition += new Vector3(0f, 0.3f, 0f);
                tile.transform.localScale = new Vector3(tileSize, 0.05f, tileSize);
            }
            else
            {
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
            if (_isInCycleMode)
            {
                ConfirmCycleDiscard();
                return;
            }

            if (GameManager.Instance.PendingLetter != null)
            {
                GameManager.Instance.ConfirmMove();

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
            var state = GameManager.Instance.GameState;
            var hand = state.Hands[state.CurrentPlayer];
            var toDiscard = new List<char>();

            foreach (int index in _selectedForDiscard)
            {
                toDiscard.Add(_currentHand[index]);
            }

            foreach (char letter in toDiscard)
            {
                hand.Remove(letter);
            }

            while (hand.Count < GameRules.HandSize && state.TileBag.Count > 0)
            {
                GameRules.DrawTile(state, state.CurrentPlayer);
            }

            Debug.Log($"Discarded {toDiscard.Count} tiles, drew back up to {hand.Count}");

            ExitCycleMode();
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