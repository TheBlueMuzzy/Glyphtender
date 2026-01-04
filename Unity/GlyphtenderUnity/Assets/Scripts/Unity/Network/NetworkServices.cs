/*******************************************************************************
 * NetworkServices.cs
 *
 * PURPOSE:
 *   Central manager for Unity Gaming Services initialization and authentication.
 *   This is the entry point for all networking functionality - it must initialize
 *   before Lobby or Relay can be used.
 *
 * RESPONSIBILITIES:
 *   - Initialize Unity Services on app start
 *   - Handle anonymous authentication (no login required)
 *   - Track connection state and player ID
 *   - Provide events for auth state changes
 *
 * ARCHITECTURE:
 *   - Singleton pattern for global access
 *   - Must be initialized before GlyphtenderLobby or GlyphtenderRelay
 *   - Provider-agnostic design (can swap to Steam/Epic later via interface)
 *
 * USAGE:
 *   await NetworkServices.Instance.InitializeAsync();
 *   if (NetworkServices.Instance.IsSignedIn) { ... }
 ******************************************************************************/

using System;
using System.Threading.Tasks;
using UnityEngine;
using Unity.Services.Core;
using Unity.Services.Authentication;

namespace Glyphtender.Unity.Network
{
    /// <summary>
    /// Connection state for the network services.
    /// </summary>
    public enum NetworkConnectionState
    {
        Disconnected,
        Connecting,
        Connected,
        Error
    }

    /// <summary>
    /// Central manager for Unity Gaming Services initialization and authentication.
    /// </summary>
    public class NetworkServices : MonoBehaviour
    {
        public static NetworkServices Instance { get; private set; }

        // State
        public NetworkConnectionState ConnectionState { get; private set; } = NetworkConnectionState.Disconnected;
        public bool IsInitialized { get; private set; }
        public bool IsSignedIn => AuthenticationService.Instance?.IsSignedIn ?? false;
        public string PlayerId => AuthenticationService.Instance?.PlayerId ?? "";
        public string LastError { get; private set; }

        // Events
        public event Action OnInitialized;
        public event Action OnSignedIn;
        public event Action OnSignedOut;
        public event Action<string> OnError;
        public event Action<NetworkConnectionState> OnConnectionStateChanged;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
            DontDestroyOnLoad(gameObject);
        }

        private void OnDestroy()
        {
            if (Instance == this)
            {
                // Unsubscribe from auth events
                if (AuthenticationService.Instance != null)
                {
                    AuthenticationService.Instance.SignedIn -= HandleSignedIn;
                    AuthenticationService.Instance.SignedOut -= HandleSignedOut;
                    AuthenticationService.Instance.Expired -= HandleSessionExpired;
                }
                Instance = null;
            }
        }

        /// <summary>
        /// Initializes Unity Services and signs in anonymously.
        /// Call this once at app start before using any networking features.
        /// </summary>
        public async Task<bool> InitializeAsync()
        {
            if (IsInitialized)
            {
                Debug.Log("[NetworkServices] Already initialized");
                return true;
            }

            SetConnectionState(NetworkConnectionState.Connecting);

            try
            {
                // Initialize Unity Services
                Debug.Log("[NetworkServices] Initializing Unity Services...");
                await UnityServices.InitializeAsync();

                // Subscribe to auth events
                AuthenticationService.Instance.SignedIn += HandleSignedIn;
                AuthenticationService.Instance.SignedOut += HandleSignedOut;
                AuthenticationService.Instance.Expired += HandleSessionExpired;

                // Sign in anonymously (creates persistent player ID)
                if (!AuthenticationService.Instance.IsSignedIn)
                {
                    Debug.Log("[NetworkServices] Signing in anonymously...");
                    await AuthenticationService.Instance.SignInAnonymouslyAsync();
                }

                IsInitialized = true;
                SetConnectionState(NetworkConnectionState.Connected);
                Debug.Log($"[NetworkServices] Initialized. Player ID: {PlayerId}");

                OnInitialized?.Invoke();
                return true;
            }
            catch (AuthenticationException ex)
            {
                LastError = $"Authentication failed: {ex.Message}";
                Debug.LogError($"[NetworkServices] {LastError}");
                SetConnectionState(NetworkConnectionState.Error);
                OnError?.Invoke(LastError);
                return false;
            }
            catch (RequestFailedException ex)
            {
                LastError = $"Request failed: {ex.Message}";
                Debug.LogError($"[NetworkServices] {LastError}");
                SetConnectionState(NetworkConnectionState.Error);
                OnError?.Invoke(LastError);
                return false;
            }
            catch (Exception ex)
            {
                LastError = $"Initialization failed: {ex.Message}";
                Debug.LogError($"[NetworkServices] {LastError}");
                SetConnectionState(NetworkConnectionState.Error);
                OnError?.Invoke(LastError);
                return false;
            }
        }

        /// <summary>
        /// Signs out the current player. Mostly for testing/debugging.
        /// </summary>
        public void SignOut()
        {
            if (AuthenticationService.Instance?.IsSignedIn == true)
            {
                AuthenticationService.Instance.SignOut();
            }
        }

        /// <summary>
        /// Attempts to re-authenticate if session expired.
        /// </summary>
        public async Task<bool> ReauthenticateAsync()
        {
            if (!IsInitialized)
            {
                return await InitializeAsync();
            }

            try
            {
                SetConnectionState(NetworkConnectionState.Connecting);
                await AuthenticationService.Instance.SignInAnonymouslyAsync();
                SetConnectionState(NetworkConnectionState.Connected);
                return true;
            }
            catch (Exception ex)
            {
                LastError = $"Reauthentication failed: {ex.Message}";
                Debug.LogError($"[NetworkServices] {LastError}");
                SetConnectionState(NetworkConnectionState.Error);
                OnError?.Invoke(LastError);
                return false;
            }
        }

        private void SetConnectionState(NetworkConnectionState newState)
        {
            if (ConnectionState != newState)
            {
                ConnectionState = newState;
                OnConnectionStateChanged?.Invoke(newState);
            }
        }

        private void HandleSignedIn()
        {
            Debug.Log($"[NetworkServices] Signed in. Player ID: {PlayerId}");
            SetConnectionState(NetworkConnectionState.Connected);
            OnSignedIn?.Invoke();
        }

        private void HandleSignedOut()
        {
            Debug.Log("[NetworkServices] Signed out");
            SetConnectionState(NetworkConnectionState.Disconnected);
            OnSignedOut?.Invoke();
        }

        private void HandleSessionExpired()
        {
            Debug.LogWarning("[NetworkServices] Session expired, attempting to reauthenticate...");
            _ = ReauthenticateAsync();
        }
    }
}
