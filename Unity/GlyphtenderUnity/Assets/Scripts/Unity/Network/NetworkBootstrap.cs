/*******************************************************************************
 * NetworkBootstrap.cs
 *
 * PURPOSE:
 *   Ensures all network-related singletons exist at startup.
 *   Creates NetworkServices, GlyphtenderLobby, and GlyphtenderRelay GameObjects.
 *
 * RESPONSIBILITIES:
 *   - Create network manager GameObjects if they don't exist
 *   - Run early via RuntimeInitializeOnLoadMethod
 *
 * ARCHITECTURE:
 *   - Static bootstrapper, no instance needed
 *   - Creates singletons under a "NetworkManagers" parent object
 *
 * USAGE:
 *   Automatic - runs on scene load
 ******************************************************************************/

using UnityEngine;

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
            // Create parent object for network managers
            var parent = new GameObject("NetworkManagers");
            Object.DontDestroyOnLoad(parent);

            // Create NetworkServices
            var services = new GameObject("NetworkServices");
            services.transform.SetParent(parent.transform);
            services.AddComponent<NetworkServices>();

            // Create GlyphtenderLobby
            var lobby = new GameObject("GlyphtenderLobby");
            lobby.transform.SetParent(parent.transform);
            lobby.AddComponent<GlyphtenderLobby>();

            // Create GlyphtenderRelay
            var relay = new GameObject("GlyphtenderRelay");
            relay.transform.SetParent(parent.transform);
            relay.AddComponent<GlyphtenderRelay>();

            // Create NetworkGameBridge
            var bridge = new GameObject("NetworkGameBridge");
            bridge.transform.SetParent(parent.transform);
            bridge.AddComponent<NetworkGameBridge>();

            // Create NetworkedGameManager
            var networkedGM = new GameObject("NetworkedGameManager");
            networkedGM.transform.SetParent(parent.transform);
            networkedGM.AddComponent<Glyphtender.Unity.NetworkedGameManager>();

            Debug.Log("[NetworkBootstrap] Network managers initialized");
        }
    }
}
