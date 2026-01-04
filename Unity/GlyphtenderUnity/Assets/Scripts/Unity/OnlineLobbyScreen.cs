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
        private GameObject[] _codeInputButtons;

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
        }

        /// <summary>
        /// Shows the lobby screen.
        /// </summary>
        public void Show()
        {
            if (State != LobbyScreenState.Hidden) return;

            _enteredCode = "";
            _errorMessage = "";

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

            // Input text (for entering code when joining)
            _inputText = CreateText("", new Vector3(0f, contentTop - 1.3f * elementScale, -0.1f), 0.1f * elementScale, valueColor, true);

            // Create buttons
            float buttonY = contentTop - 2.2f * elementScale;
            _createButton = CreateButton("CREATE ROOM", new Vector3(0f, buttonY, -0.08f), 2f * elementScale, OnCreateRoomClicked);
            _joinButton = CreateButton("JOIN ROOM", new Vector3(0f, buttonY - 0.6f * elementScale, -0.08f), 2f * elementScale, OnJoinRoomClicked);

            // Confirm join button (for after entering code)
            _confirmJoinButton = CreateButton("CONNECT", new Vector3(0f, buttonY, -0.08f), 2f * elementScale, OnConfirmJoinClicked);

            // Create code input buttons (A-Z, 0-9 simplified to just digits for room codes)
            CreateCodeInputButtons(contentTop - 2.0f * elementScale, elementScale);

            // Back button at bottom
            float backY = -(panelHeight / 2f) + (0.4f * elementScale);
            _backButton = CreateButton("BACK", new Vector3(0f, backY, -0.08f), 1.5f * elementScale, OnBackClicked);
        }

        private void CreateCodeInputButtons(float yStart, float scale)
        {
            // Create digit buttons 0-9 and backspace for entering room codes
            // Room codes are typically 6 uppercase alphanumeric characters
            // We'll create a simple keyboard: digits on one row, some common letters on another

            _codeInputButtons = new GameObject[12]; // 0-9 + backspace + clear

            string[] chars = { "1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "<", "C" };
            float buttonWidth = 0.4f * scale;
            float spacing = 0.05f * scale;
            float totalWidth = 6 * buttonWidth + 5 * spacing;
            float startX = -totalWidth / 2f + buttonWidth / 2f;

            for (int row = 0; row < 2; row++)
            {
                for (int col = 0; col < 6; col++)
                {
                    int index = row * 6 + col;
                    if (index >= chars.Length) break;

                    string c = chars[index];
                    float x = startX + col * (buttonWidth + spacing);
                    float y = yStart - row * (0.45f * scale);

                    int capturedIndex = index;
                    _codeInputButtons[index] = CreateSmallButton(c, new Vector3(x, y, -0.08f), buttonWidth, 0.35f * scale, () => OnCodeInputClicked(chars[capturedIndex]));
                }
            }
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

        private GameObject CreateSmallButton(string text, Vector3 localPos, float width, float height, Action onClick)
        {
            GameObject btn = GameObject.CreatePrimitive(PrimitiveType.Cube);
            btn.name = $"Key_{text}";
            btn.transform.SetParent(_menuRoot.transform);
            btn.transform.localPosition = localPos;
            btn.transform.localRotation = Quaternion.identity;
            btn.transform.localScale = new Vector3(width, height, 0.05f);
            btn.layer = LayerMask.NameToLayer("UI3D");

            var renderer = btn.GetComponent<Renderer>();
            if (buttonMaterial != null)
                renderer.material = buttonMaterial;
            else
                renderer.material.color = new Color(0.25f, 0.25f, 0.3f);
            renderer.shadowCastingMode = ShadowCastingMode.Off;

            GameObject textObj = new GameObject("Text");
            textObj.transform.SetParent(btn.transform);
            textObj.transform.localPosition = new Vector3(0f, 0f, -1.5f);
            textObj.transform.localRotation = Quaternion.identity;
            textObj.transform.localScale = new Vector3(0.08f, 0.1f, 1f);
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
            SetCodeInputButtonsVisible(false);

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
                    _statusText.text = "Enter room code:";
                    _inputText.gameObject.SetActive(true);
                    _inputText.text = _enteredCode.Length > 0 ? _enteredCode : "______";
                    SetCodeInputButtonsVisible(true);
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

        private void SetCodeInputButtonsVisible(bool visible)
        {
            if (_codeInputButtons == null) return;
            foreach (var btn in _codeInputButtons)
            {
                if (btn != null) btn.SetActive(visible);
            }
        }

        #region Button Handlers

        private async void OnCreateRoomClicked()
        {
            SetState(LobbyScreenState.CreatingRoom);

            // Initialize network services if needed
            if (!NetworkServices.Instance?.IsSignedIn == true)
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
            }
            // OnLobbyCreated will be called if successful
        }

        private void OnJoinRoomClicked()
        {
            _enteredCode = "";
            SetState(LobbyScreenState.EnteringCode);
        }

        private void OnCodeInputClicked(string input)
        {
            if (input == "<")
            {
                // Backspace
                if (_enteredCode.Length > 0)
                {
                    _enteredCode = _enteredCode.Substring(0, _enteredCode.Length - 1);
                }
            }
            else if (input == "C")
            {
                // Clear
                _enteredCode = "";
            }
            else
            {
                // Add character (max 6)
                if (_enteredCode.Length < 6)
                {
                    _enteredCode += input;
                }
            }

            UpdateUI();
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
            if (!NetworkServices.Instance?.IsSignedIn == true)
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

            // Allocate relay (host) or get relay code and join (guest)
            if (GlyphtenderLobby.Instance.IsHost)
            {
                // Host: Allocate relay and update lobby with join code
                string relayCode = await GlyphtenderRelay.Instance.AllocateRelayAsync();
                if (relayCode == null)
                {
                    ShowError("Failed to create relay connection");
                    return;
                }

                await GlyphtenderLobby.Instance.UpdateLobbyDataAsync("relayCode", relayCode);

                // Start host
                if (!GlyphtenderRelay.Instance.ConfigureTransportAndStart())
                {
                    ShowError("Failed to start network host");
                    return;
                }
            }
            else
            {
                // Guest: Get relay code from lobby and join
                string relayCode = GlyphtenderLobby.Instance.GetLobbyData("relayCode");

                // Wait for relay code if not available yet
                int attempts = 0;
                while (string.IsNullOrEmpty(relayCode) && attempts < 10)
                {
                    await System.Threading.Tasks.Task.Delay(500);
                    relayCode = GlyphtenderLobby.Instance.GetLobbyData("relayCode");
                    attempts++;
                }

                if (string.IsNullOrEmpty(relayCode))
                {
                    ShowError("Failed to get relay connection from host");
                    return;
                }

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

            // Start the game
            if (GameManager.Instance != null)
            {
                GameManager.Instance.InitializeGame();
            }
        }
    }
}
