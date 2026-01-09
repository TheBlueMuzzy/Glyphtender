/*******************************************************************************
 * OnlineLobbyScreen.cs
 *
 * PURPOSE:
 *   3D UI screen for online multiplayer lobby.
 *   Allows players to create or join a room using room codes.
 *
 * RESPONSIBILITIES:
 *   - Show Create Room / Join Room options
 *   - Display room code when hosting (waiting for guest)
 *   - Input field for entering room code when joining
 *   - Connect to NetworkServices, GlyphtenderLobby, GlyphtenderRelay
 *   - Transition to game when both players connected
 *
 * ARCHITECTURE:
 *   - Singleton pattern matching other screens
 *   - 3D UI rendered by UICamera (same pattern as MainMenuScreen, MenuController)
 *   - Multiple states: ChooseRole, CreatingRoom, WaitingForGuest, JoiningRoom, Connecting
 *
 * USAGE:
 *   OnlineLobbyScreen.Instance.Show();
 ******************************************************************************/

using System;
using UnityEngine;
using UnityEngine.Rendering;
using Unity.Netcode;
using Glyphtender.Unity.Network;

namespace Glyphtender.Unity
{
    /// <summary>
    /// Lobby screen state.
    /// </summary>
    public enum LobbyScreenState
    {
        Hidden,
        ChooseRole,       // Initial: Create or Join?
        CreatingRoom,     // Connecting to services, creating lobby
        WaitingForGuest,  // Room created, showing code, waiting
        EnteringCode,     // Join mode: entering room code
        JoiningRoom,      // Connecting to host's room
        StartingGame,     // Both connected, starting game
        Error             // Something went wrong
    }

    /// <summary>
    /// 3D UI screen for online multiplayer lobby.
    /// </summary>
    public class OnlineLobbyScreen : MonoBehaviour
    {
        public static OnlineLobbyScreen Instance { get; private set; }

        [Header("References")]
        public Camera uiCamera;

        [Header("Appearance")]
        public Material panelMaterial;
        public Material buttonMaterial;
        public float panelWidth = 6.0f;
        public float panelHeight = 7.0f;
        public float menuZ = 5f;

        [Header("Colors")]
        public Color titleColor = new Color(0.9f, 0.85f, 0.7f);
        public Color labelColor = new Color(0.7f, 0.7f, 0.75f);
        public Color valueColor = new Color(0.85f, 0.9f, 1f);
        public Color codeColor = new Color(0.4f, 0.8f, 0.4f);
        public Color errorColor = new Color(0.9f, 0.3f, 0.3f);

        [Header("Animation")]
        public float openDuration = 0.2f;
        public float closeDuration = 0.15f;

        // State
        public LobbyScreenState State { get; private set; } = LobbyScreenState.Hidden;
        private string _enteredCode = "";
        private string _errorMessage = "";
        private int _selectedPlayerCount = 2;  // For player count selector (2, 3, or 4)

        // Debug overlay for on-screen diagnostics
        private static string _debugInfo = "";
        private static GameObject _debugOverlay;
        private static TextMesh _debugText;

        // UI elements
        private GameObject _menuRoot;
        private GameObject _backgroundBlocker;
        private TextMesh _titleText;
        private TextMesh _statusText;
        private TextMesh _roomCodeText;
        private TextMesh _inputText;
        private GameObject _createButton;
        private GameObject _joinButton;
        private GameObject _backButton;
        private GameObject _confirmJoinButton;
        private GameObject _inputFieldButton;  // Clickable area to open keyboard

        // Player count selector
        private TextMesh _playerCountLabel;
        private GameObject _playerCount2Btn;
        private GameObject _playerCount3Btn;
        private GameObject _playerCount4Btn;

        // Keyboard input
        private TouchScreenKeyboard _touchKeyboard;
        private bool _isWaitingForKeyboardInput;

        // Animation
        private bool _isAnimating;
        private float _animationTime;
        private Vector3 _animationStartScale;
        private Vector3 _animationEndScale;

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
            if (uiCamera == null)
            {
                var camObj = GameObject.Find("UICamera");
                if (camObj != null) uiCamera = camObj.GetComponent<Camera>();
            }

            // Subscribe to lobby events
            if (GlyphtenderLobby.Instance != null)
            {
                GlyphtenderLobby.Instance.OnLobbyCreated += OnLobbyCreated;
                GlyphtenderLobby.Instance.OnPlayerJoined += OnPlayerJoined;
                GlyphtenderLobby.Instance.OnLobbyJoined += OnLobbyJoined;
                GlyphtenderLobby.Instance.OnError += OnLobbyError;
            }
        }

        private void OnDestroy()
        {
            if (GlyphtenderLobby.Instance != null)
            {
                GlyphtenderLobby.Instance.OnLobbyCreated -= OnLobbyCreated;
                GlyphtenderLobby.Instance.OnPlayerJoined -= OnPlayerJoined;
                GlyphtenderLobby.Instance.OnLobbyJoined -= OnLobbyJoined;
                GlyphtenderLobby.Instance.OnError -= OnLobbyError;
            }

            if (Instance == this)
            {
                Instance = null;
            }
        }

        private void Update()
        {
            // Handle animation
            if (_isAnimating && _menuRoot != null)
            {
                _animationTime += Time.deltaTime;
                float duration = _animationEndScale == Vector3.zero ? closeDuration : openDuration;
                float t = Mathf.Clamp01(_animationTime / duration);
                float eased = 1f - Mathf.Pow(1f - t, 3f);

                _menuRoot.transform.localScale = Vector3.Lerp(_animationStartScale, _animationEndScale, eased);

                if (t >= 1f)
                {
                    _isAnimating = false;
                    if (_animationEndScale == Vector3.zero)
                    {
                        _menuRoot.SetActive(false);
                        _backgroundBlocker.SetActive(false);
                    }
                }
            }

            // Handle keyboard input when in EnteringCode state
            if (State == LobbyScreenState.EnteringCode)
            {
                HandleKeyboardInput();
            }

            // Refresh slot count display when waiting for players
            if (State == LobbyScreenState.WaitingForGuest)
            {
                // The lobby polls in GlyphtenderLobby.PollLobbyAsync(), but we need
                // to refresh our UI to show updated player count
                int target = GlyphtenderLobby.Instance?.TargetPlayerCount ?? 2;
                int current = GlyphtenderLobby.Instance?.PlayerCount ?? 1;
                _statusText.text = $"Waiting for players ({current}/{target})";
            }
        }

        private void HandleKeyboardInput()
        {
            // Check touch keyboard (mobile)
            if (_touchKeyboard != null)
            {
                if (_touchKeyboard.status == TouchScreenKeyboard.Status.Done ||
                    _touchKeyboard.status == TouchScreenKeyboard.Status.Visible)
                {
                    string text = _touchKeyboard.text.ToUpper();
                    // Filter to alphanumeric only, max 6 chars
                    _enteredCode = "";
                    foreach (char c in text)
                    {
                        if (char.IsLetterOrDigit(c) && _enteredCode.Length < 6)
                        {
                            _enteredCode += c;
                        }
                    }
                    UpdateUI();
                }

                if (_touchKeyboard.status == TouchScreenKeyboard.Status.Done ||
                    _touchKeyboard.status == TouchScreenKeyboard.Status.Canceled)
                {
                    _touchKeyboard = null;
                    _isWaitingForKeyboardInput = false;
                }
            }

            // Handle PC keyboard input
            if (!TouchScreenKeyboard.isSupported || !_isWaitingForKeyboardInput)
            {
                foreach (char c in Input.inputString)
                {
                    if (c == '\b') // Backspace
                    {
                        if (_enteredCode.Length > 0)
                        {
                            _enteredCode = _enteredCode.Substring(0, _enteredCode.Length - 1);
                            UpdateUI();
                        }
                    }
                    else if (c == '\n' || c == '\r') // Enter
                    {
                        if (_enteredCode.Length >= 6)
                        {
                            OnConfirmJoinClicked();
                        }
                    }
                    else if (char.IsLetterOrDigit(c) && _enteredCode.Length < 6)
                    {
                        _enteredCode += char.ToUpper(c);
                        UpdateUI();
                    }
                }
            }
        }

        /// <summary>
        /// Shows the lobby screen.
        /// </summary>
        public void Show()
        {
            if (State != LobbyScreenState.Hidden) return;

            _enteredCode = "";
            _errorMessage = "";

            // Find UI camera if not set
            if (uiCamera == null)
            {
                var camObj = GameObject.Find("UICamera");
                if (camObj != null) uiCamera = camObj.GetComponent<Camera>();
            }

            if (uiCamera == null)
            {
                Debug.LogError("[OnlineLobbyScreen] UICamera not found! Cannot show lobby screen.");
                return;
            }

            // Destroy old menu if exists
            if (_menuRoot != null)
            {
                Destroy(_menuRoot);
            }

            CreateMenu();
            SetState(LobbyScreenState.ChooseRole);

            // Hide main menu
            MainMenuScreen.Instance?.Hide();

            // Animate in
            _menuRoot.SetActive(true);
            _backgroundBlocker.SetActive(true);
            _animationStartScale = Vector3.zero;
            _animationEndScale = Vector3.one;
            _menuRoot.transform.localScale = _animationStartScale;
            _animationTime = 0f;
            _isAnimating = true;
        }

        /// <summary>
        /// Hides the lobby screen.
        /// </summary>
        public void Hide()
        {
            if (State == LobbyScreenState.Hidden) return;

            SetState(LobbyScreenState.Hidden);

            // Leave any lobby we're in
            if (GlyphtenderLobby.Instance?.CurrentLobby != null)
            {
                _ = GlyphtenderLobby.Instance.LeaveLobbyAsync();
            }

            // Animate out
            _animationStartScale = Vector3.one;
            _animationEndScale = Vector3.zero;
            _animationTime = 0f;
            _isAnimating = true;
        }

        private void SetState(LobbyScreenState newState)
        {
            State = newState;
            UpdateUI();
        }

        private void CreateMenu()
        {
            _menuRoot = new GameObject("OnlineLobbyPanel");
            _menuRoot.transform.SetParent(uiCamera.transform);
            _menuRoot.transform.localPosition = new Vector3(0f, 0f, menuZ);
            _menuRoot.transform.localRotation = Quaternion.identity;
            _menuRoot.layer = LayerMask.NameToLayer("UI3D");

            CreateBackgroundBlocker();
            CreatePanelBackground();
            CreateUIElements();
        }

        private void CreateBackgroundBlocker()
        {
            _backgroundBlocker = GameObject.CreatePrimitive(PrimitiveType.Quad);
            _backgroundBlocker.name = "BackgroundBlocker";
            _backgroundBlocker.transform.SetParent(uiCamera.transform);
            _backgroundBlocker.transform.localPosition = new Vector3(0f, 0f, menuZ + 0.5f);
            _backgroundBlocker.transform.localRotation = Quaternion.identity;
            _backgroundBlocker.transform.localScale = new Vector3(50f, 50f, 1f);
            _backgroundBlocker.layer = LayerMask.NameToLayer("UI3D");

            var renderer = _backgroundBlocker.GetComponent<Renderer>();
            Material invisMat = new Material(Shader.Find("Standard"));
            invisMat.color = new Color(0, 0, 0, 0.5f);
            invisMat.SetFloat("_Mode", 3);
            invisMat.SetInt("_SrcBlend", (int)BlendMode.SrcAlpha);
            invisMat.SetInt("_DstBlend", (int)BlendMode.OneMinusSrcAlpha);
            invisMat.SetInt("_ZWrite", 0);
            invisMat.DisableKeyword("_ALPHATEST_ON");
            invisMat.EnableKeyword("_ALPHABLEND_ON");
            invisMat.renderQueue = 3000;
            renderer.material = invisMat;
            renderer.shadowCastingMode = ShadowCastingMode.Off;

            // Consume clicks
            var handler = _backgroundBlocker.AddComponent<MenuButtonClickHandler>();
            handler.OnClick = () => { };
        }

        private void CreatePanelBackground()
        {
            GameObject panel = GameObject.CreatePrimitive(PrimitiveType.Cube);
            panel.name = "PanelBackground";
            panel.transform.SetParent(_menuRoot.transform);
            panel.transform.localPosition = Vector3.zero;
            panel.transform.localRotation = Quaternion.identity;
            panel.transform.localScale = new Vector3(panelWidth, panelHeight, 0.05f);
            panel.layer = LayerMask.NameToLayer("UI3D");

            var renderer = panel.GetComponent<Renderer>();
            if (panelMaterial != null)
                renderer.material = panelMaterial;
            else
                renderer.material.color = new Color(0.12f, 0.12f, 0.15f);
            renderer.shadowCastingMode = ShadowCastingMode.Off;

            var panelHandler = panel.AddComponent<MenuButtonClickHandler>();
            panelHandler.OnClick = () => { };
        }

        private void CreateUIElements()
        {
            float elementScale = panelHeight / 5.0f;
            float contentTop = (panelHeight / 2f) - (0.4f * elementScale);

            // Title
            _titleText = CreateText("ONLINE PLAY", new Vector3(0f, contentTop, -0.1f), 0.08f * elementScale, titleColor, true);

            // Status text (shows current state message)
            _statusText = CreateText("", new Vector3(0f, contentTop - 0.6f * elementScale, -0.1f), 0.05f * elementScale, labelColor, false);

            // Room code display (large, for showing to host)
            _roomCodeText = CreateText("", new Vector3(0f, contentTop - 1.3f * elementScale, -0.1f), 0.12f * elementScale, codeColor, true);

            // Input text (for entering code when joining) - clickable to open keyboard on mobile
            _inputText = CreateText("", new Vector3(0f, contentTop - 1.3f * elementScale, -0.1f), 0.1f * elementScale, valueColor, true);

            // Create clickable input field background (for mobile keyboard)
            _inputFieldButton = CreateInputFieldButton(new Vector3(0f, contentTop - 1.3f * elementScale, -0.05f), 3f * elementScale, 0.5f * elementScale);

            // Player count selector (for host when creating room)
            float selectorY = contentTop - 1.5f * elementScale;
            _playerCountLabel = CreateText("Players:", new Vector3(-1.2f * elementScale, selectorY, -0.1f), 0.04f * elementScale, labelColor, false);

            // Small buttons for 2, 3, 4 player count
            float btnWidth = 0.5f * elementScale;
            float btnSpacing = 0.55f * elementScale;
            float btnX = 0.3f * elementScale;
            _playerCount2Btn = CreateSmallButton("2", new Vector3(btnX, selectorY, -0.08f), btnWidth, () => SetPlayerCount(2));
            _playerCount3Btn = CreateSmallButton("3", new Vector3(btnX + btnSpacing, selectorY, -0.08f), btnWidth, () => SetPlayerCount(3));
            _playerCount4Btn = CreateSmallButton("4", new Vector3(btnX + 2 * btnSpacing, selectorY, -0.08f), btnWidth, () => SetPlayerCount(4));

            // Create buttons
            float buttonY = contentTop - 2.5f * elementScale;
            _createButton = CreateButton("CREATE ROOM", new Vector3(0f, buttonY, -0.08f), 2f * elementScale, OnCreateRoomClicked);
            _joinButton = CreateButton("JOIN ROOM", new Vector3(0f, buttonY - 0.6f * elementScale, -0.08f), 2f * elementScale, OnJoinRoomClicked);

            // Confirm join button (for after entering code)
            _confirmJoinButton = CreateButton("CONNECT", new Vector3(0f, buttonY - 0.6f * elementScale, -0.08f), 2f * elementScale, OnConfirmJoinClicked);

            // Back button at bottom
            float backY = -(panelHeight / 2f) + (0.4f * elementScale);
            _backButton = CreateButton("BACK", new Vector3(0f, backY, -0.08f), 1.5f * elementScale, OnBackClicked);
        }

        private GameObject CreateInputFieldButton(Vector3 localPos, float width, float height)
        {
            // Create a clickable background for the input field
            // On mobile, tapping this opens the keyboard
            GameObject btn = GameObject.CreatePrimitive(PrimitiveType.Cube);
            btn.name = "InputFieldButton";
            btn.transform.SetParent(_menuRoot.transform);
            btn.transform.localPosition = localPos;
            btn.transform.localRotation = Quaternion.identity;
            btn.transform.localScale = new Vector3(width, height, 0.02f);
            btn.layer = LayerMask.NameToLayer("UI3D");

            var renderer = btn.GetComponent<Renderer>();
            renderer.material.color = new Color(0.2f, 0.2f, 0.25f);
            renderer.shadowCastingMode = ShadowCastingMode.Off;

            var handler = btn.AddComponent<MenuButtonClickHandler>();
            handler.OnClick = OnInputFieldClicked;

            return btn;
        }

        private void OnInputFieldClicked()
        {
            // Open keyboard on mobile devices
            if (TouchScreenKeyboard.isSupported)
            {
                _touchKeyboard = TouchScreenKeyboard.Open(
                    _enteredCode,
                    TouchScreenKeyboardType.Default,
                    false,  // autocorrection
                    false,  // multiline
                    false,  // secure
                    false,  // alert
                    "Enter 6-character room code",
                    6       // character limit
                );
                _isWaitingForKeyboardInput = true;
            }
            // On PC, keyboard input is already handled in Update()
        }

        private TextMesh CreateText(string text, Vector3 localPos, float scale, Color color, bool bold)
        {
            GameObject obj = new GameObject("Text");
            obj.transform.SetParent(_menuRoot.transform);
            obj.transform.localPosition = localPos;
            obj.transform.localRotation = Quaternion.identity;
            obj.transform.localScale = new Vector3(scale, scale, scale);
            obj.layer = LayerMask.NameToLayer("UI3D");

            var textMesh = obj.AddComponent<TextMesh>();
            textMesh.text = text;
            textMesh.fontSize = 48;
            textMesh.alignment = TextAlignment.Center;
            textMesh.anchor = TextAnchor.MiddleCenter;
            textMesh.color = color;
            if (bold) textMesh.fontStyle = FontStyle.Bold;

            return textMesh;
        }

        private GameObject CreateButton(string text, Vector3 localPos, float width, Action onClick)
        {
            float elementScale = panelHeight / 5.0f;

            GameObject btn = GameObject.CreatePrimitive(PrimitiveType.Cube);
            btn.name = $"Button_{text}";
            btn.transform.SetParent(_menuRoot.transform);
            btn.transform.localPosition = localPos;
            btn.transform.localRotation = Quaternion.identity;
            btn.transform.localScale = new Vector3(width, 0.4f * elementScale, 0.05f);
            btn.layer = LayerMask.NameToLayer("UI3D");

            var renderer = btn.GetComponent<Renderer>();
            if (buttonMaterial != null)
                renderer.material = buttonMaterial;
            else
                renderer.material.color = new Color(0.3f, 0.3f, 0.35f);
            renderer.shadowCastingMode = ShadowCastingMode.Off;

            GameObject textObj = new GameObject("Text");
            textObj.transform.SetParent(btn.transform);
            textObj.transform.localPosition = new Vector3(0f, 0f, -1.5f);
            textObj.transform.localRotation = Quaternion.identity;
            textObj.transform.localScale = new Vector3(0.03f, 0.1f, 1f);
            textObj.layer = LayerMask.NameToLayer("UI3D");

            var textMesh = textObj.AddComponent<TextMesh>();
            textMesh.text = text;
            textMesh.fontSize = 36;
            textMesh.alignment = TextAlignment.Center;
            textMesh.anchor = TextAnchor.MiddleCenter;
            textMesh.color = Color.white;

            var handler = btn.AddComponent<MenuButtonClickHandler>();
            handler.OnClick = onClick;

            return btn;
        }

        /// <summary>
        /// Creates a small square button (for player count selector).
        /// </summary>
        private GameObject CreateSmallButton(string text, Vector3 localPos, float size, Action onClick)
        {
            float elementScale = panelHeight / 5.0f;

            GameObject btn = GameObject.CreatePrimitive(PrimitiveType.Cube);
            btn.name = $"PlayerCount_{text}";
            btn.transform.SetParent(_menuRoot.transform);
            btn.transform.localPosition = localPos;
            btn.transform.localRotation = Quaternion.identity;
            btn.transform.localScale = new Vector3(size, 0.35f * elementScale, 0.05f);
            btn.layer = LayerMask.NameToLayer("UI3D");

            var renderer = btn.GetComponent<Renderer>();
            if (buttonMaterial != null)
                renderer.material = new Material(buttonMaterial);  // Clone to allow individual coloring
            else
                renderer.material = new Material(Shader.Find("Standard"));
            renderer.material.color = new Color(0.25f, 0.25f, 0.3f);
            renderer.shadowCastingMode = ShadowCastingMode.Off;

            GameObject textObj = new GameObject("Text");
            textObj.transform.SetParent(btn.transform);
            textObj.transform.localPosition = new Vector3(0f, 0f, -1.5f);
            textObj.transform.localRotation = Quaternion.identity;
            textObj.transform.localScale = new Vector3(0.05f, 0.12f, 1f);
            textObj.layer = LayerMask.NameToLayer("UI3D");

            var textMesh = textObj.AddComponent<TextMesh>();
            textMesh.text = text;
            textMesh.fontSize = 36;
            textMesh.alignment = TextAlignment.Center;
            textMesh.anchor = TextAnchor.MiddleCenter;
            textMesh.color = Color.white;

            var handlerComponent = btn.AddComponent<MenuButtonClickHandler>();
            handlerComponent.OnClick = onClick;

            return btn;
        }

        /// <summary>
        /// Sets the selected player count and updates button highlighting.
        /// </summary>
        private void SetPlayerCount(int count)
        {
            _selectedPlayerCount = count;
            UpdatePlayerCountButtonColors();
        }

        /// <summary>
        /// Updates player count button colors based on selection.
        /// </summary>
        private void UpdatePlayerCountButtonColors()
        {
            Color selectedColor = new Color(0.3f, 0.6f, 0.4f);  // Greenish for selected
            Color unselectedColor = new Color(0.25f, 0.25f, 0.3f);  // Dark gray

            if (_playerCount2Btn != null)
                _playerCount2Btn.GetComponent<Renderer>().material.color = (_selectedPlayerCount == 2) ? selectedColor : unselectedColor;
            if (_playerCount3Btn != null)
                _playerCount3Btn.GetComponent<Renderer>().material.color = (_selectedPlayerCount == 3) ? selectedColor : unselectedColor;
            if (_playerCount4Btn != null)
                _playerCount4Btn.GetComponent<Renderer>().material.color = (_selectedPlayerCount == 4) ? selectedColor : unselectedColor;
        }

        private void UpdateUI()
        {
            if (_menuRoot == null) return;

            // Hide everything first
            _createButton?.SetActive(false);
            _joinButton?.SetActive(false);
            _confirmJoinButton?.SetActive(false);
            _roomCodeText?.gameObject.SetActive(false);
            _inputText?.gameObject.SetActive(false);
            _inputFieldButton?.SetActive(false);

            // Hide player count selector by default
            _playerCountLabel?.gameObject.SetActive(false);
            _playerCount2Btn?.SetActive(false);
            _playerCount3Btn?.SetActive(false);
            _playerCount4Btn?.SetActive(false);

            // Reset status text color
            _statusText.color = labelColor;

            switch (State)
            {
                case LobbyScreenState.ChooseRole:
                    _titleText.text = "ONLINE PLAY";
                    _statusText.text = "Choose an option";
                    _createButton.SetActive(true);
                    _joinButton.SetActive(true);
                    // Show player count selector
                    _playerCountLabel?.gameObject.SetActive(true);
                    _playerCount2Btn?.SetActive(true);
                    _playerCount3Btn?.SetActive(true);
                    _playerCount4Btn?.SetActive(true);
                    UpdatePlayerCountButtonColors();
                    break;

                case LobbyScreenState.CreatingRoom:
                    _statusText.text = "Creating room...";
                    break;

                case LobbyScreenState.WaitingForGuest:
                    // Update title based on player count
                    int target = GlyphtenderLobby.Instance?.TargetPlayerCount ?? 2;
                    _titleText.text = target == 2 ? "ONLINE 1v1" : $"ONLINE {target}P";
                    // Show slot status
                    int current = GlyphtenderLobby.Instance?.PlayerCount ?? 1;
                    _statusText.text = $"Waiting for players ({current}/{target})";
                    _roomCodeText.gameObject.SetActive(true);
                    _roomCodeText.text = GlyphtenderLobby.Instance?.RoomCode ?? "------";
                    break;

                case LobbyScreenState.EnteringCode:
                    _titleText.text = "JOIN ROOM";
                    _statusText.text = TouchScreenKeyboard.isSupported
                        ? "Tap below to enter code:"
                        : "Type room code:";
                    _inputText.gameObject.SetActive(true);
                    _inputText.text = _enteredCode.Length > 0 ? _enteredCode : "______";
                    _inputFieldButton?.SetActive(true);
                    _confirmJoinButton.SetActive(_enteredCode.Length >= 6);
                    break;

                case LobbyScreenState.JoiningRoom:
                    _statusText.text = "Joining room...";
                    break;

                case LobbyScreenState.StartingGame:
                    _statusText.text = "Starting game...";
                    break;

                case LobbyScreenState.Error:
                    _titleText.text = "ONLINE PLAY";
                    _statusText.text = _errorMessage;
                    _statusText.color = errorColor;
                    _createButton.SetActive(true);
                    _joinButton.SetActive(true);
                    // Show player count selector on error too
                    _playerCountLabel?.gameObject.SetActive(true);
                    _playerCount2Btn?.SetActive(true);
                    _playerCount3Btn?.SetActive(true);
                    _playerCount4Btn?.SetActive(true);
                    UpdatePlayerCountButtonColors();
                    break;
            }
        }

        #region Button Handlers

        private async void OnCreateRoomClicked()
        {
            SetState(LobbyScreenState.CreatingRoom);

            // Initialize network services if needed
            if (NetworkServices.Instance == null || !NetworkServices.Instance.IsSignedIn)
            {
                bool success = await NetworkServices.Instance.InitializeAsync();
                if (!success)
                {
                    ShowError("Failed to connect to services");
                    return;
                }
            }

            // Create lobby with current game settings and selected player count
            var settings = new LobbyGameSettings
            {
                BoardSizeIndex = SettingsManager.Instance?.BoardSizeIndex ?? 1,
                Allow2LetterWords = SettingsManager.Instance?.Allow2LetterWords ?? true
            };

            Debug.Log($"[OnlineLobbyScreen] Creating lobby with {_selectedPlayerCount} players");
            string roomCode = await GlyphtenderLobby.Instance.CreateLobbyAsync(settings, _selectedPlayerCount);
            if (roomCode == null)
            {
                ShowError(GlyphtenderLobby.Instance?.LastError ?? "Failed to create room");
                return;
            }

            // IMPORTANT: Allocate relay NOW so guest can connect immediately when they join
            Debug.Log("[OnlineLobbyScreen] Pre-allocating relay before guest joins...");
            string relayCode = await GlyphtenderRelay.Instance.AllocateRelayAsync();
            if (relayCode == null)
            {
                ShowError("Failed to create relay connection");
                await GlyphtenderLobby.Instance.LeaveLobbyAsync();
                return;
            }

            // CRITICAL FIX: Start the host IMMEDIATELY after allocation, BEFORE sharing the join code.
            // The relay allocation exists but isn't "active" until the host binds to it via StartHost().
            // Previously, we waited until the guest joined the lobby before calling StartHost(),
            // which caused a race condition: guest would try to join the relay before host was bound.
            // This was the root cause of "join code not found" errors on cross-network connections.
            Debug.Log("[OnlineLobbyScreen] Starting host on relay immediately after allocation...");
            if (!GlyphtenderRelay.Instance.ConfigureTransportAndStart())
            {
                ShowError("Failed to start network host");
                await GlyphtenderLobby.Instance.LeaveLobbyAsync();
                return;
            }

            // Spawn NetworkGameBridge so RPCs work when guest connects
            if (NetworkGameBridge.Instance != null)
            {
                var networkObject = NetworkGameBridge.Instance.GetComponent<NetworkObject>();
                if (networkObject != null && !networkObject.IsSpawned)
                {
                    networkObject.Spawn();
                    Debug.Log("[OnlineLobbyScreen] NetworkGameBridge spawned on network");
                }
            }

            // Small delay to ensure host is fully ready before advertising the relay code
            Debug.Log($"[OnlineLobbyScreen] Host started. Waiting 1s before sharing relay code...");
            await System.Threading.Tasks.Task.Delay(1000);

            Debug.Log($"[OnlineLobbyScreen] Updating lobby with relay code: {relayCode}");
            await GlyphtenderLobby.Instance.UpdateLobbyDataAsync("relayCode", relayCode);

            // Write debug info to desktop for PC build debugging
            WriteHostDebugFile(roomCode, relayCode);

            // OnLobbyCreated will be called to show the room code
        }

        private void OnJoinRoomClicked()
        {
            _enteredCode = "";
            SetState(LobbyScreenState.EnteringCode);

            // On mobile, open keyboard immediately
            if (TouchScreenKeyboard.isSupported)
            {
                OnInputFieldClicked();
            }
        }

        private async void OnConfirmJoinClicked()
        {
            if (_enteredCode.Length < 6)
            {
                ShowError("Code must be 6 characters");
                return;
            }

            SetState(LobbyScreenState.JoiningRoom);

            // Initialize network services if needed
            if (NetworkServices.Instance == null || !NetworkServices.Instance.IsSignedIn)
            {
                bool success = await NetworkServices.Instance.InitializeAsync();
                if (!success)
                {
                    ShowError("Failed to connect to services");
                    return;
                }
            }

            bool joined = await GlyphtenderLobby.Instance.JoinLobbyByCodeAsync(_enteredCode);
            if (!joined)
            {
                ShowError(GlyphtenderLobby.Instance?.LastError ?? "Failed to join room");
            }
            // OnLobbyJoined will be called if successful
        }

        private void OnBackClicked()
        {
            Hide();
            MainMenuScreen.Instance?.Show();
        }

        #endregion

        #region Lobby Event Handlers

        private void OnLobbyCreated(string roomCode)
        {
            Debug.Log($"[OnlineLobbyScreen] Room created: {roomCode}");
            SetState(LobbyScreenState.WaitingForGuest);
        }

        private void OnPlayerJoined()
        {
            Debug.Log("[OnlineLobbyScreen] Guest joined!");
            StartGame();
        }

        private void OnLobbyJoined()
        {
            Debug.Log("[OnlineLobbyScreen] Joined lobby as guest");
            StartGame();
        }

        private void OnLobbyError(string error)
        {
            ShowError(error);
        }

        #endregion

        private void ShowError(string message)
        {
            _errorMessage = message;
            SetState(LobbyScreenState.Error);
        }

        /// <summary>
        /// Writes host debug info to a file on Desktop for PC build debugging.
        /// </summary>
        private void WriteHostDebugFile(string roomCode, string relayCode)
        {
            try
            {
                string desktopPath = System.Environment.GetFolderPath(System.Environment.SpecialFolder.Desktop);
                string filePath = System.IO.Path.Combine(desktopPath, "glyphtender_host_debug.txt");
                string timestamp = System.DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
                string cloudId = UnityEngine.Application.cloudProjectId;
                string playerId = NetworkServices.Instance?.PlayerId ?? "(unknown)";
                string relayRegion = GlyphtenderRelay.Instance?.GetAllocatedRegion() ?? "(unknown)";

                string content = $"=== Glyphtender Host Debug ===\n" +
                                 $"Timestamp: {timestamp}\n" +
                                 $"Room Code (Lobby): {roomCode}\n" +
                                 $"Relay Code: {relayCode} (length={relayCode?.Length})\n" +
                                 $"Relay Region: {relayRegion}\n" +
                                 $"Environment: production (explicit)\n" +
                                 $"CloudProjectId: {cloudId}\n" +
                                 $"PlayerId: {playerId}\n" +
                                 $"IsEditor: {Application.isEditor}\n" +
                                 $"Platform: {Application.platform}\n" +
                                 $"Version: {Application.version}\n";

                System.IO.File.WriteAllText(filePath, content);
                Debug.Log($"[OnlineLobbyScreen] Wrote host debug file to: {filePath}");
            }
            catch (System.Exception ex)
            {
                Debug.LogWarning($"[OnlineLobbyScreen] Failed to write debug file: {ex.Message}");
            }
        }

        /// <summary>
        /// Shows debug info on screen (visible without logcat)
        /// </summary>
        private static void ShowDebugOverlay(string info)
        {
            _debugInfo = info;

            // Create overlay if it doesn't exist
            if (_debugOverlay == null)
            {
                _debugOverlay = new GameObject("DebugOverlay");
                DontDestroyOnLoad(_debugOverlay);

                // Use GUI text that renders on top of everything
                var canvas = _debugOverlay.AddComponent<Canvas>();
                canvas.renderMode = RenderMode.ScreenSpaceOverlay;
                canvas.sortingOrder = 9999;

                var textObj = new GameObject("DebugText");
                textObj.transform.SetParent(_debugOverlay.transform);

                var text = textObj.AddComponent<UnityEngine.UI.Text>();
                text.font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
                text.fontSize = 24;
                text.color = Color.yellow;
                text.alignment = TextAnchor.UpperLeft;
                text.horizontalOverflow = HorizontalWrapMode.Wrap;
                text.verticalOverflow = VerticalWrapMode.Overflow;

                var rectTransform = textObj.GetComponent<RectTransform>();
                rectTransform.anchorMin = new Vector2(0, 0.7f);
                rectTransform.anchorMax = new Vector2(1, 1);
                rectTransform.offsetMin = new Vector2(10, 0);
                rectTransform.offsetMax = new Vector2(-10, -10);

                _debugText = null; // We're using UI.Text instead
                textObj.GetComponent<UnityEngine.UI.Text>().text = _debugInfo;
            }
            else
            {
                var text = _debugOverlay.GetComponentInChildren<UnityEngine.UI.Text>();
                if (text != null)
                {
                    text.text = _debugInfo;
                }
            }
        }

        private async void StartGame()
        {
            SetState(LobbyScreenState.StartingGame);

            Debug.Log($"[OnlineLobbyScreen] StartGame called. IsHost={GlyphtenderLobby.Instance?.IsHost}");

            // Host: relay already started in OnCreateRoomClicked, just wait for all players to connect
            // Guest: get relay code from lobby and join
            int targetPlayerCount = GlyphtenderLobby.Instance?.TargetPlayerCount ?? 2;

            if (GlyphtenderLobby.Instance.IsHost)
            {
                // Host already called ConfigureTransportAndStart() and spawned NetworkGameBridge
                // in OnCreateRoomClicked(). Now we just wait for all players to connect via relay.
                Debug.Log($"[OnlineLobbyScreen] Host path: Relay already started, waiting for {targetPlayerCount} players to connect...");

                // Wait for all players to connect via relay
                int connectAttempts = 0;
                while (NetworkManager.Singleton.ConnectedClientsIds.Count < targetPlayerCount && connectAttempts < 60) // 60 * 200ms = 12 seconds
                {
                    await System.Threading.Tasks.Task.Delay(200);
                    connectAttempts++;
                }

                if (NetworkManager.Singleton.ConnectedClientsIds.Count < targetPlayerCount)
                {
                    Debug.LogWarning($"[OnlineLobbyScreen] Not all players connected in time ({NetworkManager.Singleton.ConnectedClientsIds.Count}/{targetPlayerCount}), starting game anyway");
                }
                else
                {
                    Debug.Log($"[OnlineLobbyScreen] All {targetPlayerCount} players connected!");
                }
            }
            else
            {
                Debug.Log("[OnlineLobbyScreen] Guest path: Waiting for relay code from host...");

                // Debug overlay disabled - uncomment these ShowDebugOverlay calls when debugging relay issues
                // string cloudId = UnityEngine.Application.cloudProjectId;
                // ShowDebugOverlay($"CloudProjectId: {cloudId}\nWaiting for relay code...");

                // Guest: Get relay code from lobby and join
                // The lobby data needs to be refreshed to get the relay code
                string relayCode = GlyphtenderLobby.Instance.GetLobbyData("relayCode");

                // Wait for relay code if not available yet - need to refresh lobby data
                int attempts = 0;
                while (string.IsNullOrEmpty(relayCode) && attempts < 20) // 20 attempts * 500ms = 10 seconds
                {
                    await System.Threading.Tasks.Task.Delay(500);
                    // Force refresh the lobby to get updated data from host
                    await GlyphtenderLobby.Instance.RefreshLobbyAsync();
                    relayCode = GlyphtenderLobby.Instance.GetLobbyData("relayCode");
                    Debug.Log($"[OnlineLobbyScreen] Attempt {attempts + 1}: relayCode = '{relayCode ?? "(null)"}'");
                    // ShowDebugOverlay($"CloudProjectId: {cloudId}\nRelayCode: {relayCode ?? "(waiting)"}\nAttempt: {attempts + 1}");
                    attempts++;
                }

                if (string.IsNullOrEmpty(relayCode))
                {
                    // ShowDebugOverlay($"CloudProjectId: {cloudId}\nERROR: No relay code received");
                    ShowError("Failed to get relay connection from host");
                    return;
                }

                // CRITICAL: Trim the relay code to remove any whitespace/encoding issues
                string rawRelayCode = relayCode;
                relayCode = relayCode.Trim();

                // Also strip any non-alphanumeric characters (just in case)
                string cleanedRelayCode = "";
                foreach (char c in relayCode)
                {
                    if (char.IsLetterOrDigit(c))
                    {
                        cleanedRelayCode += c;
                    }
                }
                relayCode = cleanedRelayCode;

                Debug.Log($"[OnlineLobbyScreen] Got relay code from lobby: raw='{rawRelayCode}' (len={rawRelayCode?.Length}), cleaned='{relayCode}' (len={relayCode?.Length})");
                // ShowDebugOverlay($"CloudProjectId: {cloudId}\nRaw code: '{rawRelayCode}' (len={rawRelayCode?.Length})\nCleaned: '{relayCode}' (len={relayCode?.Length})\nJoining relay...");

                // Debug: Log the exact relay code characters to check for hidden chars
                if (!string.IsNullOrEmpty(rawRelayCode))
                {
                    string charDebug = "";
                    foreach (char c in rawRelayCode)
                    {
                        charDebug += $"[{c}:{(int)c}]";
                    }
                    Debug.Log($"[OnlineLobbyScreen] Raw relay code chars: {charDebug}");
                }

                bool joined = await GlyphtenderRelay.Instance.JoinRelayAsync(relayCode);
                if (!joined)
                {
                    string errorDetail = GlyphtenderRelay.Instance.LastError ?? "Unknown error";
                    // string guestPlayerId = NetworkServices.Instance?.PlayerId ?? "(unknown)";
                    Debug.LogError($"[OnlineLobbyScreen] Relay join failed: {errorDetail}");
                    // ShowDebugOverlay($"CloudProjectId: {cloudId}\nPlayerId: {guestPlayerId}\nRaw: '{rawRelayCode}' len={rawRelayCode?.Length}\nCleaned: '{relayCode}' len={relayCode?.Length}\nERROR: {errorDetail}");
                    ShowError($"Failed to join relay: {errorDetail}");
                    return;
                }

                // Start client
                if (!GlyphtenderRelay.Instance.ConfigureTransportAndStart())
                {
                    ShowError("Failed to start network client");
                    return;
                }

                // Wait for client to actually connect to host
                Debug.Log("[OnlineLobbyScreen] Waiting for connection to host...");
                int connectAttempts = 0;
                while (!NetworkManager.Singleton.IsConnectedClient && connectAttempts < 30) // 30 * 200ms = 6 seconds
                {
                    await System.Threading.Tasks.Task.Delay(200);
                    connectAttempts++;
                }

                if (!NetworkManager.Singleton.IsConnectedClient)
                {
                    ShowError("Failed to connect to host");
                    return;
                }

                Debug.Log("[OnlineLobbyScreen] Connected to host!");
            }

            // Hide lobby screen and start game
            Hide();

            // Apply game settings from lobby
            var lobbySettings = GlyphtenderLobby.Instance.GetGameSettings();
            if (lobbySettings != null && SettingsManager.Instance != null)
            {
                SettingsManager.Instance.BoardSizeIndex = lobbySettings.BoardSizeIndex;
                SettingsManager.Instance.Allow2LetterWords = lobbySettings.Allow2LetterWords;
            }

            // Set online player count from lobby (2, 3, or 4)
            if (SettingsManager.Instance != null)
            {
                SettingsManager.Instance.OnlinePlayerCount = GlyphtenderLobby.Instance?.TargetPlayerCount ?? 2;
            }

            // CRITICAL: Set PlayMode to Online1v1 so NetworkedGameManager activates
            if (SettingsManager.Instance != null)
            {
                SettingsManager.Instance.PlayMode = PlayMode.Online1v1;
            }

            Debug.Log($"[OnlineLobbyScreen] Starting game. PlayMode={SettingsManager.Instance?.PlayMode}, IsHost={GlyphtenderLobby.Instance?.IsHost}");

            // Start the game
            if (GameManager.Instance != null)
            {
                GameManager.Instance.InitializeGame();
            }
        }
    }
}
