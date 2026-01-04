/*******************************************************************************
 * NetworkBootstrap.cs
 *
 * PURPOSE:
 *   Ensures all network-related singletons exist at startup.
 *   Creates NetworkServices, GlyphtenderLobby, GlyphtenderRelay, and NetworkManager.
 *
 * RESPONSIBILITIES:
 *   - Create network manager GameObjects if they don't exist
 *   - Create Unity NetworkManager with UnityTransport for Netcode
 *   - Run early via RuntimeInitializeOnLoadMethod
 *
 * ARCHITECTURE:
 *   - Static bootstrapper, no instance needed
 *   - Creates singletons as root objects for DontDestroyOnLoad
 *
 * USAGE:
 *   Automatic - runs on scene load
 ******************************************************************************/

using UnityEngine;
using Unity.Netcode;
using Unity.Netcode.Transports.UTP;

namespace Glyphtender.Unity.Network
{
    /// <summary>
    /// Bootstraps network singletons on scene load.
    /// </summary>
    public static class NetworkBootstrap
    {
        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.BeforeSceneLoad)]
        private static void Initialize()
        {
            // Create each network manager as a root object so DontDestroyOnLoad works
            // Each component handles its own DontDestroyOnLoad in Awake()

            // Create Unity NetworkManager with UnityTransport (required for Netcode)
            if (NetworkManager.Singleton == null)
            {
                var networkManagerObj = new GameObject("NetworkManager");
                var networkManager = networkManagerObj.AddComponent<NetworkManager>();
                var transport = networkManagerObj.AddComponent<UnityTransport>();

                // CRITICAL: Assign the transport to the NetworkManager's config
                networkManager.NetworkConfig = new NetworkConfig();
                networkManager.NetworkConfig.NetworkTransport = transport;

                Object.DontDestroyOnLoad(networkManagerObj);
                Debug.Log("[NetworkBootstrap] NetworkManager with UnityTransport created");
            }

            // Create NetworkServices
            var services = new GameObject("NetworkServices");
            services.AddComponent<NetworkServices>();

            // Create GlyphtenderLobby
            var lobby = new GameObject("GlyphtenderLobby");
            lobby.AddComponent<GlyphtenderLobby>();

            // Create GlyphtenderRelay
            var relay = new GameObject("GlyphtenderRelay");
            relay.AddComponent<GlyphtenderRelay>();

            // Create NetworkGameBridge (must be spawned after NetworkManager starts)
            var bridge = new GameObject("NetworkGameBridge");
            bridge.AddComponent<NetworkGameBridge>();

            // Create NetworkedGameManager
            var networkedGM = new GameObject("NetworkedGameManager");
            networkedGM.AddComponent<Glyphtender.Unity.NetworkedGameManager>();

            Debug.Log("[NetworkBootstrap] Network managers initialized");
        }
    }
}
