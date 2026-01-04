/*******************************************************************************
 * NetworkMessages.cs
 *
 * PURPOSE:
 *   Defines serializable data structures for network synchronization.
 *   These structs are used by Netcode for GameObjects to send game actions
 *   between host and client.
 *
 * RESPONSIBILITIES:
 *   - Define INetworkSerializable structs for each game action type
 *   - Serialize HexCoord, move data, cast data, draft placements
 *   - Keep payloads minimal for low latency
 *
 * ARCHITECTURE:
 *   - All structs implement INetworkSerializable for Netcode
 *   - Used by NetworkGameBridge for RPCs
 *   - Maps to Core game actions (move, cast, draft placement)
 *
 * USAGE:
 *   var moveData = new NetworkMoveData { ... };
 *   NetworkGameBridge.Instance.SendMoveServerRpc(moveData);
 ******************************************************************************/

using Unity.Netcode;
using Unity.Collections;
using Glyphtender.Core;

namespace Glyphtender.Unity.Network
{
    /// <summary>
    /// Network-serializable version of HexCoord.
    /// </summary>
    public struct NetworkHexCoord : INetworkSerializable
    {
        public int Col;
        public int Row;

        public NetworkHexCoord(int col, int row)
        {
            Col = col;
            Row = row;
        }

        public NetworkHexCoord(HexCoord coord)
        {
            Col = coord.Col;
            Row = coord.Row;
        }

        public HexCoord ToHexCoord()
        {
            return new HexCoord(Col, Row);
        }

        public void NetworkSerialize<T>(BufferSerializer<T> serializer) where T : IReaderWriter
        {
            serializer.SerializeValue(ref Col);
            serializer.SerializeValue(ref Row);
        }
    }

    /// <summary>
    /// Data for a glyphling move action.
    /// </summary>
    public struct NetworkMoveData : INetworkSerializable
    {
        public int GlyphlingIndex;      // Which glyphling (0 or 1 for the player)
        public NetworkHexCoord From;
        public NetworkHexCoord To;

        public void NetworkSerialize<T>(BufferSerializer<T> serializer) where T : IReaderWriter
        {
            serializer.SerializeValue(ref GlyphlingIndex);
            From.NetworkSerialize(serializer);
            To.NetworkSerialize(serializer);
        }
    }

    /// <summary>
    /// Data for a tile cast action.
    /// </summary>
    public struct NetworkCastData : INetworkSerializable
    {
        public byte Letter;             // The letter being cast (as byte)
        public NetworkHexCoord Position;

        public char GetLetter() => (char)Letter;
        public void SetLetter(char c) => Letter = (byte)c;

        public void NetworkSerialize<T>(BufferSerializer<T> serializer) where T : IReaderWriter
        {
            serializer.SerializeValue(ref Letter);
            Position.NetworkSerialize(serializer);
        }
    }

    /// <summary>
    /// Combined move + cast for a complete turn.
    /// </summary>
    public struct NetworkTurnData : INetworkSerializable
    {
        public NetworkMoveData Move;
        public NetworkCastData Cast;

        public void NetworkSerialize<T>(BufferSerializer<T> serializer) where T : IReaderWriter
        {
            Move.NetworkSerialize(serializer);
            Cast.NetworkSerialize(serializer);
        }
    }

    /// <summary>
    /// Data for draft phase glyphling placement.
    /// </summary>
    public struct NetworkDraftPlacement : INetworkSerializable
    {
        public NetworkHexCoord Position;

        public void NetworkSerialize<T>(BufferSerializer<T> serializer) where T : IReaderWriter
        {
            Position.NetworkSerialize(serializer);
        }
    }

    /// <summary>
    /// Data for tile cycle (discard and draw).
    /// </summary>
    public struct NetworkCycleData : INetworkSerializable
    {
        // Using a fixed-size array since hands are max 8 tiles
        // Each byte is 1 if that tile index should be discarded, 0 otherwise
        public byte DiscardMask;

        public void SetDiscardIndex(int index, bool discard)
        {
            if (discard)
                DiscardMask |= (byte)(1 << index);
            else
                DiscardMask &= (byte)~(1 << index);
        }

        public bool IsDiscarding(int index)
        {
            return (DiscardMask & (1 << index)) != 0;
        }

        public void NetworkSerialize<T>(BufferSerializer<T> serializer) where T : IReaderWriter
        {
            serializer.SerializeValue(ref DiscardMask);
        }
    }

    /// <summary>
    /// Initial game state sent from host to client at game start.
    /// Contains tile bag order and initial hands.
    /// </summary>
    public struct NetworkGameStart : INetworkSerializable
    {
        // Fixed-size arrays for tile data
        // Total tiles in standard bag: ~100 tiles
        // We'll use a FixedString for compactness (letters as string)
        public FixedString512Bytes TileBagOrder;
        public FixedString32Bytes YellowHand;
        public FixedString32Bytes BlueHand;
        public int BoardSizeIndex;
        public bool Allow2LetterWords;

        public void NetworkSerialize<T>(BufferSerializer<T> serializer) where T : IReaderWriter
        {
            serializer.SerializeValue(ref TileBagOrder);
            serializer.SerializeValue(ref YellowHand);
            serializer.SerializeValue(ref BlueHand);
            serializer.SerializeValue(ref BoardSizeIndex);
            serializer.SerializeValue(ref Allow2LetterWords);
        }
    }

    /// <summary>
    /// Forfeit notification.
    /// </summary>
    public struct NetworkForfeit : INetworkSerializable
    {
        public byte ForfeitingPlayer;   // 0 = Yellow, 1 = Blue

        public Player GetPlayer() => (Player)ForfeitingPlayer;
        public void SetPlayer(Player p) => ForfeitingPlayer = (byte)p;

        public void NetworkSerialize<T>(BufferSerializer<T> serializer) where T : IReaderWriter
        {
            serializer.SerializeValue(ref ForfeitingPlayer);
        }
    }

    /// <summary>
    /// Rematch request/response.
    /// </summary>
    public struct NetworkRematch : INetworkSerializable
    {
        public bool IsRequest;          // true = requesting, false = accepting/declining
        public bool Accepted;           // Only used when IsRequest = false

        public void NetworkSerialize<T>(BufferSerializer<T> serializer) where T : IReaderWriter
        {
            serializer.SerializeValue(ref IsRequest);
            serializer.SerializeValue(ref Accepted);
        }
    }
}
