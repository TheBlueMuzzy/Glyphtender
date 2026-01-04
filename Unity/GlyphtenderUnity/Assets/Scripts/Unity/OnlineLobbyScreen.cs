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
            _titleText = CreateText("ONLINE 1v1", new Vector3(0f, contentTop, -0.1f), 0.08f * elementScale, titleColor, true);

            // Status text (shows current state message)
            _statusText = CreateText("", new Vector3(0f, contentTop - 0.6f * elementScale, -0.1f), 0.05f * elementScale, labelColor, false);

            // Room code display (large, for showing to host)
            _roomCodeText = CreateText("", new Vector3(0f, contentTop - 1.3f * elementScale, -0.1f), 0.12f * elementScale, codeColor, true);

            // Input text (for entering code when joining) - clickable to open keyboard on mobile
            _inputText = CreateText("", new Vector3(0f, contentTop - 1.3f * elementScale, -0.1f), 0.1f * elementScale, valueColor, true);

            // Create clickable input field background (for mobile keyboard)
            _inputFieldButton = CreateInputFieldButton(new Vector3(0f, contentTop - 1.3f * elementScale, -0.05f), 3f * elementScale, 0.5f * elementScale);

            // Create buttons
            float buttonY = contentTop - 2.2f * elementScale;
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

            // Reset status text color
            _statusText.color = labelColor;

            switch (State)
            {
                case LobbyScreenState.ChooseRole:
                    _statusText.text = "Choose an option";
                    _createButton.SetActive(true);
                    _joinButton.SetActive(true);
                    break;

                case LobbyScreenState.CreatingRoom:
                    _statusText.text = "Creating room...";
                    break;

                case LobbyScreenState.WaitingForGuest:
                    _statusText.text = "Share this code:";
                    _roomCodeText.gameObject.SetActive(true);
                    _roomCodeText.text = GlyphtenderLobby.Instance?.RoomCode ?? "------";
                    break;

                case LobbyScreenState.EnteringCode:
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
                    _statusText.text = _errorMessage;
                    _statusText.color = errorColor;
                    _createButton.SetActive(true);
                    _joinButton.SetActive(true);
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

            // Create lobby with current game settings
            var settings = new LobbyGameSettings
            {
                BoardSizeIndex = SettingsManager.Instance?.BoardSizeIndex ?? 1,
                Allow2LetterWords = SettingsManager.Instance?.Allow2LetterWords ?? true
            };

            string roomCode = await GlyphtenderLobby.Instance.CreateLobbyAsync(settings);
            if (roomCode == null)
            {
                ShowError(GlyphtenderLobby.Instance?.LastError ?? "Failed to create room");
                return;
            }

            // IMPORTANT: Allocate relay NOW so guest can connect immediately when they join
            // This prevents race condition where guest joins but relay isn't ready yet
            Debug.Log("[OnlineLobbyScreen] Pre-allocating relay before guest joins...");
            string relayCode = await GlyphtenderRelay.Instance.AllocateRelayAsync();
            if (relayCode == null)
            {
                ShowError("Failed to create relay connection");
                await GlyphtenderLobby.Instance.LeaveLobbyAsync();
                return;
            }

            Debug.Log($"[OnlineLobbyScreen] Relay pre-allocated: {relayCode}. Updating lobby...");
            await GlyphtenderLobby.Instance.UpdateLobbyDataAsync("relayCode", relayCode);

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

        private async void StartGame()
        {
            SetState(LobbyScreenState.StartingGame);

            Debug.Log($"[OnlineLobbyScreen] StartGame called. IsHost={GlyphtenderLobby.Instance?.IsHost}");

            // Host: relay already allocated in OnCreateRoomClicked, just start host
            // Guest: get relay code from lobby and join
            if (GlyphtenderLobby.Instance.IsHost)
            {
                Debug.Log("[OnlineLobbyScreen] Host path: Configuring transport and starting host...");

                // Relay was already allocated in OnCreateRoomClicked
                // Just start the host
                if (!GlyphtenderRelay.Instance.ConfigureTransportAndStart())
                {
                    ShowError("Failed to start network host");
                    return;
                }

                // CRITICAL: Host must spawn the NetworkGameBridge so RPCs work
                if (NetworkGameBridge.Instance != null)
                {
                    var networkObject = NetworkGameBridge.Instance.GetComponent<NetworkObject>();
                    if (networkObject != null && !networkObject.IsSpawned)
                    {
                        networkObject.Spawn();
                        Debug.Log("[OnlineLobbyScreen] NetworkGameBridge spawned on network");
                    }
                }

                Debug.Log("[OnlineLobbyScreen] Host started. Waiting for guest to connect via relay...");

                // Wait for guest to connect
                int connectAttempts = 0;
                while (NetworkManager.Singleton.ConnectedClientsIds.Count < 2 && connectAttempts < 60) // 60 * 200ms = 12 seconds
                {
                    await System.Threading.Tasks.Task.Delay(200);
                    connectAttempts++;
                }

                if (NetworkManager.Singleton.ConnectedClientsIds.Count < 2)
                {
                    Debug.LogWarning("[OnlineLobbyScreen] Guest didn't connect in time, starting game anyway");
                }
                else
                {
                    Debug.Log("[OnlineLobbyScreen] Guest connected!");
                }
            }
            else
            {
                Debug.Log("[OnlineLobbyScreen] Guest path: Waiting for relay code from host...");

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
                    attempts++;
                }

                if (string.IsNullOrEmpty(relayCode))
                {
                    ShowError("Failed to get relay connection from host");
                    return;
                }

                Debug.Log($"[OnlineLobbyScreen] Got relay code: {relayCode}. Joining relay...");

                bool joined = await GlyphtenderRelay.Instance.JoinRelayAsync(relayCode);
                if (!joined)
                {
                    ShowError("Failed to join relay");
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
