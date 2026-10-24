/* ============================================================================
   LECTURE 9 STUDY — THE NOTEBOOKLM VIDEO PROMPTS
   ----------------------------------------------------------------------------
   Pasted into NotebookLM's Video Overview steering prompt, with the exported
   PDF (Read + Play + the code cards) as the only source. Checked 2026-10-24:
   Google's help page (support.google.com/notebooklm/answer/16454555) lists
   the formats Cinematic (18+, English only), Explainer ("a structured,
   comprehensive overview that connects the dots within your sources") and
   Short (~60-second videos; Lecture 8's note of 2026-10-22 called it Brief),
   and an optional steering prompt with a suggested or custom topic. It
   states no character limit for the prompt, so each prompt here stays under
   1,000 characters. Explainer is the format to pick.

   The deck is long (69 slides), so there is a single-video prompt and a
   two-part variant: part 1 = §0–§9 (the policy side: the RL loop to policy
   gradients), part 2 = §10–§18 (the value side: Markov chains to deep
   Q-learning). The page shows these and never prints them.
   ========================================================================== */

export const NLM_PROMPT = `Use only this PDF: a CITS5017 study page on reinforcement learning. Teach a student new to RL who is revising for an exam that shows code and asks for a diagram or an explanation. Follow the sections in order, in the PDF's notation, with its two running examples: CartPole and Figure 18-8's three-state MDP. Intuition first, then the precise statement. Most time on: the agent-environment loop; policies and policy search; credit assignment and discounted returns (γ = 0.8 gives −22); REINFORCE's four steps; Markov chains and MDPs; the Bellman equation, value and Q-value iteration (why γ = 0.95 sends s1 into the fire); TD learning; Q-learning and ε-greedy; approximate and deep Q-learning (the target y(s,a), the replay buffer); catastrophic forgetting. For each code block, say in plain words what it does. Numbers marked "this page's own" are not the lecture's: say so. End with five self-test questions.`;

export const NLM_PARTS = [
  {
    label: 'Part 1 of 2 · §0–§9',
    text: `Part 1 of 2. Use only this PDF, sections §0 to §9: a CITS5017 study page on reinforcement learning, the policy side. Teach a student new to RL who is revising for an exam that shows code and asks for a diagram or an explanation. Follow the sections in order, in the PDF's notation, with CartPole as the running example. Intuition first, then the precise statement. Most time on: the agent-environment loop and the goal of maximising expected long-term rewards; what a policy is, stochastic policies, and policy search (brute force, genetic algorithms, policy gradients); CartPole's observation, actions and env.step's five return values; neural network policies and sampling the action; credit assignment, discounted returns (γ = 0.8 gives −22) and action advantages; REINFORCE's four steps; y_target = 1 − action and the training loop. Explain each code block in plain words. Numbers marked "this page's own" are not the lecture's. End with four self-test questions.`,
  },
  {
    label: 'Part 2 of 2 · §10–§18',
    text: `Part 2 of 2. Use only this PDF, sections §10 to §18: a CITS5017 study page on reinforcement learning, the value side. Teach a student who knows the RL loop and policy gradients but is new to MDPs, revising for an exam that shows code and asks for a diagram or an explanation. Follow the sections in order, in the PDF's notation, with Figure 18-8's three-state MDP and CartPole as running examples. Intuition first, then the precise statement. Most time on: Markov chains and the transition matrix; MDPs; the Bellman optimality equation; value and Q-value iteration and the argmax policy (why γ = 0.95 sends s1 into the fire); the TD update, target and error; Q-learning, off- vs on-policy, ε-greedy; approximate Q-learning and the DQN target y(s,a); the replay buffer and training_step; catastrophic forgetting. Explain each code block in plain words. Numbers marked "this page's own" are not the lecture's. End with four self-test questions.`,
  },
];

export const NLM_STEPS = [
  'Export the PDF with the button above (in the print dialog, choose “Save as PDF”).',
  'In NotebookLM, add the PDF as a source in a new notebook.',
  'Studio → Video Overview → customise: choose the Explainer format, paste one prompt as the steering prompt, then generate (for the two-part variant, generate twice, once per part).',
];
