export default class DialogueBehavior {
    constructor(dialogueUI) {
        this.dialogueUI = dialogueUI;
        this.talkingAgent = null;
        this.onEnd = null;
    }

    start(agent, onEndCallback) {
        this.talkingAgent = agent;
        this.onEnd = onEndCallback;
        this.handleState(1);
    }

    handleState(state) {
        if (!this.talkingAgent) return;

        switch (state) {
            case 1: // Initial approach
                this.dialogueUI.show(`An agent of the ${this.talkingAgent.originalColor} team approaches.`, [
                    { text: 'Profile', callback: () => this.handleState(2) },
                    { text: 'Elicit', callback: () => this.handleState(3) }
                ]);
                break;
            case 2: // Profiling result
                this.dialogueUI.show(`You've determined the agent is a(n) ${this.talkingAgent.negotiationCharacterType}.`, [
                    { text: 'Leave', callback: () => this.end(false) }
                ]);
                break;
            case 3: // Elicitation result (leads to conversion)
                this.dialogueUI.show('You have convinced the agent to join your cause.', [
                    { text: 'Leave', callback: () => this.end(true) }
                ]);
                break;
        }
    }

    end(shouldConvert) {
        if (this.onEnd) {
            this.onEnd(this.talkingAgent, shouldConvert);
        }
        this.talkingAgent = null;
        this.dialogueUI.hide();
    }
}
