/*******************************************************************************
 * GlyphtenderRelay.cs
 *
 * PURPOSE:
 *   Manages Unity Relay connections for NAT traversal.
 *   Allows two players behind home routers to connect directly.
 *
 * RESPONSIBILITIES:
 *   - Allocate relay server (host)
 *   - Get join code for guest
 *   - Connect to relay (guest)
 *   - Configure Unity Transport with relay data
 *
 * ARCHITECTURE:
 *   - Singleton pattern for global access
 *   - Requires NetworkServices to be initialized first
 *   - Works with GlyphtenderLobby for matchmaking
 *   - Configures Unity Transport for Netcode for GameObjects
 *
 * USAGE:
 *   // Host:
 *   string joinCode = await GlyphtenderRelay.Instance.AllocateRelayAsync();
 *   await GlyphtenderLobby.Instance.UpdateLobbyDataAsync("relayCode", joinCode);
 *
 *   // Guest:
 *   string joinCode = GlyphtenderLobby.Instance.GetLobbyData("relayCode");
 *   await GlyphtenderRelay.Instance.JoinRelayAsync(joinCode);
 ******************************************************************************/

using System;
using System.Threading.Tasks;
using UnityEngine;
using Unity.Services.Relay;
using Unity.Services.Relay.Models;
using Unity.Netcode;
using Unity.Netcode.Transports.UTP;
using Unity.Networking.Transport.Relay;

namespace Glyphtender.Unity.Network
{
    /// <summary>
    /// Relay connection state.
    /// </summary>
    public enum RelayState
    {
        Disconnected,
        Allocating,
        Connecting,
        Connected,
        Error
    }

    /// <summary>
    /// Manages Unity Relay connections for NAT traversal.
    /// </summary>
    public class GlyphtenderRelay : MonoBehaviour
    {
        public static GlyphtenderRelay Instance { get; private set; }

        // Relay settings
        private const int MAX_CONNECTIONS = 1;  // 1v1 only

        // State
        public RelayState State { get; private set; } = RelayState.Disconnected;
        public string JoinCode { get; private set; }
        public bool IsHost { get; private set; }
        public string LastError { get; private set; }

        // Events
        public event Action<string> OnRelayAllocated;  // Join code
        public event Action OnRelayJoined;
        public event Action OnRelayDisconnected;
        public event Action<string> OnError;
        public event Action<RelayState> OnStateChanged;

        // Cached data
        private Allocation _hostAllocation;
        private JoinAllocation _guestAllocation;

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
                Instance = null;
            }
        }

        /// <summary>
        /// Allocates a relay server and returns the join code.
        /// Call this as host after creating a lobby.
        /// </summary>
        public async Task<string> AllocateRelayAsync()
        {
            if (!NetworkServices.Instance.IsSignedIn)
            {
                LastError = "Not signed in. Call NetworkServices.InitializeAsync() first.";
                OnError?.Invoke(LastError);
                return null;
            }

            SetState(RelayState.Allocating);

            try
            {
                Debug.Log("[GlyphtenderRelay] Allocating relay server...");

                // Allocate relay with 1 max connection (1v1)
                _hostAllocation = await RelayService.Instance.CreateAllocationAsync(MAX_CONNECTIONS);

                // Get join code
                JoinCode = await RelayService.Instance.GetJoinCodeAsync(_hostAllocation.AllocationId);

                IsHost = true;
                SetState(RelayState.Connected);

                Debug.Log($"[GlyphtenderRelay] Relay allocated. Join code: {JoinCode}");

                OnRelayAllocated?.Invoke(JoinCode);
                return JoinCode;
            }
            catch (RelayServiceException ex)
            {
                LastError = $"Failed to allocate relay: {ex.Message}";
                Debug.LogError($"[GlyphtenderRelay] {LastError}");
                SetState(RelayState.Error);
                OnError?.Invoke(LastError);
                return null;
            }
        }

        /// <summary>
        /// Joins an existing relay using the join code.
        /// Call this as guest after joining a lobby.
        /// </summary>
        public async Task<bool> JoinRelayAsync(string joinCode)
        {
            if (!NetworkServices.Instance.IsSignedIn)
            {
                LastError = "Not signed in. Call NetworkServices.InitializeAsync() first.";
                OnError?.Invoke(LastError);
                return false;
            }

            if (string.IsNullOrEmpty(joinCode))
            {
                LastError = "Join code cannot be empty.";
                OnError?.Invoke(LastError);
                return false;
            }

            SetState(RelayState.Connecting);

            try
            {
                Debug.Log($"[GlyphtenderRelay] Joining relay with code: {joinCode}");

                _guestAllocation = await RelayService.Instance.JoinAllocationAsync(joinCode);

                JoinCode = joinCode;
                IsHost = false;
                SetState(RelayState.Connected);

                Debug.Log("[GlyphtenderRelay] Joined relay successfully");

                OnRelayJoined?.Invoke();
                return true;
            }
            catch (RelayServiceException ex)
            {
                LastError = $"Failed to join relay: {ex.Message}";
                Debug.LogError($"[GlyphtenderRelay] {LastError}");
                SetState(RelayState.Error);
                OnError?.Invoke(LastError);
                return false;
            }
        }

        /// <summary>
        /// Configures Unity Transport with relay data and starts the network.
        /// Call this after relay is connected but before starting Netcode.
        /// </summary>
        public bool ConfigureTransportAndStart()
        {
            var transport = NetworkManager.Singleton?.GetComponent<UnityTransport>();
            if (transport == null)
            {
                LastError = "UnityTransport component not found on NetworkManager.";
                Debug.LogError($"[GlyphtenderRelay] {LastError}");
                OnError?.Invoke(LastError);
                return false;
            }

            try
            {
                if (IsHost)
                {
                    if (_hostAllocation == null)
                    {
                        LastError = "No host allocation. Call AllocateRelayAsync first.";
                        OnError?.Invoke(LastError);
                        return false;
                    }

                    // Configure transport for host
                    var relayServerData = new RelayServerData(_hostAllocation, "dtls");
                    transport.SetRelayServerData(relayServerData);

                    Debug.Log("[GlyphtenderRelay] Starting host...");
                    NetworkManager.Singleton.StartHost();
                }
                else
                {
                    if (_guestAllocation == null)
                    {
                        LastError = "No guest allocation. Call JoinRelayAsync first.";
                        OnError?.Invoke(LastError);
                        return false;
                    }

                    // Configure transport for client
                    var relayServerData = new RelayServerData(_guestAllocation, "dtls");
                    transport.SetRelayServerData(relayServerData);

                    Debug.Log("[GlyphtenderRelay] Starting client...");
                    NetworkManager.Singleton.StartClient();
                }

                return true;
            }
            catch (Exception ex)
            {
                LastError = $"Failed to configure transport: {ex.Message}";
                Debug.LogError($"[GlyphtenderRelay] {LastError}");
                OnError?.Invoke(LastError);
                return false;
            }
        }

        /// <summary>
        /// Disconnects from the relay.
        /// </summary>
        public void Disconnect()
        {
            if (NetworkManager.Singleton?.IsListening == true)
            {
                NetworkManager.Singleton.Shutdown();
            }

            _hostAllocation = null;
            _guestAllocation = null;
            JoinCode = null;
            IsHost = false;
            SetState(RelayState.Disconnected);

            OnRelayDisconnected?.Invoke();
        }

        /// <summary>
        /// Gets the relay server endpoint info (for debugging).
        /// </summary>
        public string GetRelayEndpoint()
        {
            if (IsHost && _hostAllocation != null)
            {
                var endpoint = _hostAllocation.RelayServer;
                return $"{endpoint.IpV4}:{endpoint.Port}";
            }
            else if (!IsHost && _guestAllocation != null)
            {
                var endpoint = _guestAllocation.RelayServer;
                return $"{endpoint.IpV4}:{endpoint.Port}";
            }
            return "Not connected";
        }

        private void SetState(RelayState newState)
        {
            if (State != newState)
            {
                State = newState;
                OnStateChanged?.Invoke(newState);
            }
        }
    }
}
