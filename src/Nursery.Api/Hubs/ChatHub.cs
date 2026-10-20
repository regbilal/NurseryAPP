using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace Nursery.Api.Hubs;

[Authorize]
public class ChatHub : Hub
{
    public Task JoinConversation(string conversationId) =>
        Groups.AddToGroupAsync(Context.ConnectionId, conversationId);
}
