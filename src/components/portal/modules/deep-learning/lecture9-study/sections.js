/* ============================================================================
   LECTURE 9 STUDY — SECTION CONTENT (the Read beat)
   ----------------------------------------------------------------------------
   The module's prose, as data, in slide order. Layout code never holds
   prose: edit a paragraph here and the page updates. The notebook pages
   (the Write beat) live in ./sheets, one file per section; the "Explain
   this code" cards in ./cards.js.

   Inline markup (rendered by Rich.jsx):
     **bold**   *italic*   `code`   $tex$   [label](#sectionId)   [^n] footnote

   Each section:
     id, no, title, short, slides     identity, rail label, slide receipt
     read      blocks — a string is a paragraph; objects are
               { eq: { name, tex, read } }, { list }, { code: { src, label } },
               { note, label? }, { slideNote }, { unfold: { label, blocks } },
               { fig } ({ code: { src } } takes inline code or a NAMED_CODE
               key from slideData.js)
     play      lab keys (components in ./labs, registry ./labs/index.js)
     cards     "Explain this code" card ids (./cards.js), after the labs

   Every slide 1–69 lands in exactly one section (tools/dl-lecture9-study/
   page-check.mjs checks the coverage from these ranges).
   ========================================================================== */

export const SECTIONS = [
  /* ── §0 ─────────────────────────────────────────────────────────────── */
  {
    id: 's00',
    no: '0',
    title: 'Intro: roadmap & how to use this page',
    short: 'Intro & roadmap',
    slides: '1–3',
    read: [
      '**Topic 9: Reinforcement Learning**, CITS5017 Deep Learning, Associate Professor Du Huynh (Unit Coordinator and Lecturer), Semester 2, 2026 (slide 1): the last topic of the unit. It covers Chapter 18 of *Hands-on Machine Learning with Scikit-Learn, Keras & TensorFlow* (slide 2 writes “Chapters 18.”).',
      'Slide 3 lists the main topics of Chapter Eighteen, ***Reinforcement Learning***: an introduction to reinforcement learning and its applications; *rewards* in RL; policy search and policy gradients; the OpenAI Gym toolkit and training a NN to create a policy for the CartPole game; evaluating actions (the credit assignment problem) and discounted rewards; Markov decision processes; the $\\epsilon$ greedy policy; and Q-learning, approximate Q-learning and deep Q-learning.',
      'Every section below follows the deck in order and has three beats: **Read** the short explanation, **Play** with the lab until the idea clicks, then **Write**: copy the notebook page onto paper and tick each line as it goes in. The notebook pages hold only what is worth memorising; anything a page leaves out is named in a grey line at its foot, and it is still here in Read and Play. Ticks and your place are saved in this browser.',
      'The labs share one picture language. The **agent** is violet and the **environment** slate; **states** are teal circles and **actions** orange (small diamonds in an MDP); **rewards** are green when positive and red when negative; **returns** and the discount $\\gamma$ are amber, the **policy** magenta, and **values** and Q-values blue. In an MDP, an arrow’s thickness is its probability. Numbers appear when you hover, and in each lab’s “Show the maths” drawer.',
      'Two running examples carry the lecture: **CartPole** for the policy side ([§4](#s04)–[§9](#s09)) and the deep Q-network ([§16](#s16)–[§17](#s17)), and **Figure 18-8’s three-state MDP** for the value side ([§11](#s11)–[§14](#s14)). The exam gives you a block of code and asks for a diagram or an explanation, so every section whose slides carry code ends its Play beat with an **“Explain this code”** card: answer it on paper, then open the model answer.',
      'Numbers printed on the slides carry their slide number. Anything this page made itself is labelled as **this page’s own**: the CartPole simulation (this page’s port of Gymnasium’s CartPole-v1, whose physics the slides don’t print), and its runs of the slides’ code.',
    ],
    play: ['roadmap'],
  },

  /* ── §1 ─────────────────────────────────────────────────────────────── */
  {
    id: 's01',
    no: '1',
    title: 'Reinforcement learning in a nutshell',
    short: 'RL in a nutshell',
    slides: '4–5',
    read: [
      '**Reinforcement Learning** (**RL**) is one of the most exciting fields of Machine Learning today, and also one of the oldest (slide 4). It has been around since the **1950s**, producing many interesting applications over the years, in particular in **games** (e.g. *TD-Gammon*) and in machine control.',
      { list: [
        '**2013:** researchers from an English startup called **DeepMind** demonstrated a system that could learn to play just about any Atari game from scratch and eventually outperform humans in most of them, using **only raw pixels** as inputs and without any prior knowledge of the rules of the games.',
        '**2014:** DeepMind was bought by Google for over **500 million dollars**.',
        '**May 2017:** these feats culminated in the victory of their system **AlphaGo** against **Ke Jie**, the world champion of the game of ***Go***.',
      ] },
      'Today the whole field is boiling with new ideas, with a wide range of applications. How did RL algorithms do it? With hindsight it seems rather simple: **they applied the power of Deep Learning to the field of Reinforcement Learning**, and it worked beyond their wildest dreams (slide 5).',
      'This lecture covers the basic concepts behind RL, including: (1) ***policy gradients*** ([§8](#s08)–[§9](#s09)), (2) ***Markov decision processes*** (**MDPs**, [§10](#s10)–[§12](#s12)) and (3) the ***Deep Q-network*** ([§15](#s15)–[§17](#s17)). The same techniques work for a wide variety of tasks, from walking robots to self-driving cars; here they are used to train models to **balance a pole on a moving cart**.',
    ],
    play: ['timeline'],
  },

  /* ── §2 ─────────────────────────────────────────────────────────────── */
  {
    id: 's02',
    no: '2',
    title: 'Learning to optimise rewards',
    short: 'Agent, environment, reward',
    slides: '6–10',
    read: [
      'In Reinforcement Learning, a software ***agent*** makes ***observations*** and takes ***actions*** within an ***environment***, and in return it receives ***rewards*** (slide 6).',
      'Its objective is to learn to act in a way that will **maximize its expected long-term rewards**. Think of positive reward as **pleasure** and negative reward as **pain**: the agent acts in the environment and learns **by trial and error** to maximize its pleasure and minimize its pain.',
      'Figure 18-1 (slides 7–10) gives a few examples:',
      { list: [
        '**A walking robot.** The agent is the program controlling it, observing the real world through **sensor readings**. Positive reward: approaching the target destination; negative reward: wasting time in the wrong direction, or falling down.',
        '**Ms. Pac-Man.** The environment is a simulation of the Atari game; the actions are the possible **joystick positions**; the observations are the **screenshots**; the rewards are just the **game points**.',
        '**A smart thermostat.** The agent doesn’t have to move anything. It gets rewards when it is close to the target temperature and saves energy, and negative rewards when humans need to tweak the temperature, so it must learn to **anticipate human needs**.',
        '**An automatic trader.** It observes stock market prices and decides how much to buy or sell every second. The rewards are the monetary gains and losses.',
        '**A robot in a maze.** There is **only negative reward** and no positive reward, so it had better find the exit as soon as possible.',
      ] },
      'Figure 18-1 also pictures (c) a Go player, which the slides never describe.',
      { slideNote: 'The item letters on slides 9–10 don’t match Figure 18-1’s panels: slide 9’s “(c)” describes the thermostat, which is panel (d); slide 10’s “(d)” describes the trader, panel (e); and slide 10’s “(e)”, the maze robot, has no panel. The list above follows the text; the Go player (panel c) is only in the caption.' },
    ],
    play: ['rlLoop'],
  },

  /* ── §3 ─────────────────────────────────────────────────────────────── */
  {
    id: 's03',
    no: '3',
    title: 'Policy search',
    short: 'Policy search',
    slides: '11–15',
    read: [
      'The algorithm a software agent uses to determine its actions is called its ***policy*** (slide 11). For example, the policy could be a **neural network** that takes observations as inputs and outputs the action to take. In Figure 18-2 the agent’s network policy sends **actions** to the environment, and the environment sends back **rewards & observations**.',
      'The policy can be any algorithm you can think of, and it doesn’t even have to be deterministic (slide 12). Take a **robotic vacuum cleaner** whose reward is the amount of dust it picks up in **30 minutes**. Its policy could be: every second, **move forward with some probability $p$**, or **randomly rotate left or right** (by a random angle between $-r$ and $+r$ degrees) with probability $1 - p$.',
      'Here $p$ and $r$ are ***policy parameters*** that you can tweak. Because randomness is involved, this is a ***stochastic policy***. The robot has an erratic trajectory, which guarantees that it will eventually get to any place it can reach and pick up all the dust.',
      '**How to find good policy parameters.** Slides 13–15 give three possible learning algorithms:',
      { list: [
        '**Brute force (slide 13).** Try all the combinations of parameter values in the ***policy space***: this is known as ***policy search***, a **brute force approach**. When the policy space is large (which is generally the case), finding a good set of parameters this way is like searching for a needle in a gigantic haystack. Figure 18-3 shows four points $a$–$d$ in the $(p, r)$ policy space and the four very different behaviours they produce.',
        '**Genetic algorithms (slide 14).** Randomly create a first generation of **100 policies** and try them out, then “kill” the **80 worst** and make the **20 survivors** produce **4 offspring each**. An offspring is just a copy of its parent. The survivors plus their offspring form the second generation ($20 + 20 \\times 4 = 100$). Keep iterating through generations until you find a good policy.',
        '**Optimisation (slide 15).** Evaluate the **gradients of the rewards with respect to the policy parameters**, then tweak the parameters by following the gradient toward higher rewards (***gradient ascent***). This approach is called ***policy gradients*** (**PG**). For the vacuum robot: slightly increase $p$ and see whether it picks up more dust in 30 minutes; if it does, increase $p$ some more, otherwise reduce $p$.',
      ] },
      { slideNote: 'Slide 14 says an offspring is “just a copy of its parent”. Read literally, the second generation holds only copies of the 20 survivors, so the search could never try anything new. The lab follows the slide; genetic algorithms usually add some random variation to each copy, which the slide doesn’t mention.' },
    ],
    play: ['vacuum', 'genetic'],
  },

  /* ── §4 ─────────────────────────────────────────────────────────────── */
  {
    id: 's04',
    no: '4',
    title: 'OpenAI Gym and the CartPole environment',
    short: 'Gym & CartPole',
    slides: '16–20',
    read: [
      'To implement a ***policy gradient*** (PG) algorithm with TensorFlow, the agent needs an environment to live in (slide 16): for example an Atari game environment to learn to play an Atari game, or a ***simulated environment*** for training a walking robot. ***OpenAI gym*** is a toolkit that provides a wide variety of simulated environments (Atari games, board games, 2D and 3D physical simulations, and so on), so you can train agents, compare them, or develop new RL algorithms. It installs with pip as `gymnasium`:',
      { unfold: { label: 'Slide 16: installing it (Colab, or your own computer)', blocks: [{ code: { src: 'INSTALL_COLAB', label: 'slide 16 · Colab or Kaggle' } }, { code: { src: 'INSTALL_LOCAL', label: 'slide 16 · your own computer' } }] } },
      '**The CartPole environment (slide 17)** is a 2D simulation of a cart that can move left or right, with a pole hinged on top. `make()` creates it and `reset()` returns the first observation:',
      { code: { src: 'MAKE_ENV', label: 'slide 17' } },
      'The four numbers in the observation vector `obs` are: **(1)** the cart’s horizontal position (0.0 = centre), **(2)** its velocity (positive means *right*), **(3)** the angle of the pole (0.0 = vertical), and **(4)** its angular velocity (positive means *clockwise*). Figure 18-4 draws them on the cart: position from 0 along the track, velocity along the track, and the angle and angular velocity of the pole.',
      { unfold: { label: 'Slide 18: rendering the environment', blocks: [
        'The environment can be rendered with the `render()` method, and the image shown with Matplotlib’s `imshow()`: a frame of 400 × 600 pixels with 3 colour channels (red, green, blue), showing the cart on its track with the pole upright.',
        { code: { src: 'RENDER', label: 'slide 18' } },
      ] } },
      '**Useful functions (slides 19–20).** `env.action_space` returns the possible actions: `Discrete(2)`, where **0 accelerates left** and **1 accelerates right**. `env.step(action)` performs the action once. Since the pole is leaning toward the right (`obs[2] > 0`), slide 20 accelerates the cart toward the right:',
      { code: { src: 'ACTION_SPACE', label: 'slide 19' } },
      { code: { src: 'STEP', label: 'slide 20' } },
      '`step()` returns five things, which slide 20 prints but doesn’t define (this page’s gloss): the new observation `obs`; the `reward` (1.0, for every step CartPole lasts); `done` (True once the episode is over: the pole has tilted too far or the cart has left the track); `truncated` (True if a time limit cut the episode off instead); and `info` (an empty dictionary here).',
      { note: 'The lab runs this page’s own port of CartPole-v1, ported from Gymnasium’s source (the slides don’t give the physics): a step is 0.02 s, a push is a force of 10 to the left or right, the episode is done when the pole tilts more than 12° or the cart leaves ±2.4, and CartPole-v1 truncates at 500 steps. From slide 17’s observation, one push right gives slide 20’s numbers to within $10^{-8}$.', label: 'This page’s port of CartPole' },
      { slideNote: 'Slide 17’s `gym.make("CartPole-v1", reader_mode="rgb_array")` should say `render_mode`, the argument slide 18’s `env.render()` needs. This page ran it in Gymnasium 1.3.0: as printed it fails with `TypeError: CartPoleEnv.__init__() got an unexpected keyword argument \'reader_mode\'`; with `render_mode="rgb_array"` it reproduces slides 17–20 (the observation, the (400, 600, 3) image, `Discrete(2)` and slide 20’s step). Slides 17 and 19 call the cart “the robot”, and slide 17’s “(positive means *clockwise*.” never closes its bracket. Slide 18 calls `env.reset()` again with no seed, yet slide 20’s output continues from slide 17’s seed-42 observation ($0.0273956 + 0.02 \\times (-0.00611216) = 0.02727336$).' },
    ],
    play: ['cartpole'],
    cards: ['makeEnv'],
  },

  /* ── §5 ─────────────────────────────────────────────────────────────── */
  {
    id: 's05',
    no: '5',
    title: 'A simple hard-coded policy',
    short: 'basic_policy',
    slides: '21–22',
    read: [
      'A first, simple policy (slide 21): **accelerate left when the pole is leaning toward the left**, and **accelerate right when it is leaning toward the right**. The pole’s angle is `obs[2]`:',
      { code: { src: 'BASIC_POLICY', label: 'slide 21' } },
      'Slide 22 runs this policy for **500 episodes** to see the average reward it gets. Each episode starts from `env.reset(seed=episode)` and lasts at most 200 steps; `episode_rewards` adds up the rewards, and `totals` keeps one total per episode:',
      { code: { src: 'BASIC_LOOP', label: 'slide 22' } },
      { note: 'This page ran slide 22’s code exactly as printed, in Gymnasium 1.3.0 (Python 3.12, NumPy 2.5.2): it prints `(41.698, 8.389445512070509, 24.0, 63.0)`, slide 22’s output to every digit. The lab’s histogram is that run.', label: 'This page’s own run' },
      'With this policy the average reward is **41.698** and the maximum is **63**. Since every step earns 1, this policy **never managed to keep the pole upright for more than 63 steps**. (The slide points to a demo video of it, `cits5017-lect09-demo-CartPole1_using-basic-hard-coded-policy.webm`, which is not part of the slides; the lab plays the policy instead.)',
    ],
    play: ['basicPolicy'],
    cards: ['basicLoop'],
  },

  /* ── §6 ─────────────────────────────────────────────────────────────── */
  {
    id: 's06',
    no: '6',
    title: 'Neural network policies',
    short: 'Neural network policies',
    slides: '23–25',
    read: [
      'We can train a neural network to be the policy (slide 23, Figure 18-5). It takes the observations $x_1, \\ldots, x_4$, passes them through a hidden layer, and its **output layer has 1 neuron**, which outputs **the probability $p$ of action 0 (left)**.',
      'The action is then **selected randomly, according to the estimated probabilities** (Figure 18-5’s “multinomial sampling”), rather than always taking the more likely one: this ***exploration/exploitation*** dilemma is central in reinforcement learning (slide 23). (This page’s gloss, since the slide names the dilemma without explaining it: picking at random lets the agent sometimes try the action it currently rates lower, which is how it explores.)',
      'In this particular environment the past actions and observations can safely be ignored, since each observation contains the environment’s **full state**.',
      '**When observations don’t contain the full state** (slide 24), you may need to consider past actions and observations as well. For example, if the environment only revealed the position of the cart but not its velocity, you would need the previous observation too, to estimate the current velocity. When the observations are **noisy**, you generally want to use the past few observations (e.g. their average) to estimate the most likely current state.',
      'The code for the network in Figure 18-5 (slide 25):',
      { code: { src: 'POLICY_NET', label: 'slide 25' } },
      'Four inputs, a hidden `Dense` layer of **5 ReLU** units and **1 sigmoid** output: the probability of going left. (Slide 25 points to the author’s notebook animation of this network playing with a random policy, `cits5017-lect09-demo-CartPole2_using-NN-random-policy.webm`.) But how do we train the network? That is the next three sections.',
      { slideNote: 'Slide 23’s first sentence is garbled: “create a policy to move the e.g., a network as shown in Figure 18-5” (a word, probably “cart”, is missing). Figure 18-5 draws **4** hidden neurons, but slide 25’s code uses `Dense(5, ...)`; this page follows the code. The first `Dense` layer is given `input_shape=[n_inputs]`: in this page’s run (Keras 3.15.1) it still works but warns “Do not pass an `input_shape`/`input_dim` argument to a layer. When using Sequential models, prefer using an `Input(shape)` object as the first layer in the model instead.” Slide 61 does the same.' },
    ],
    play: ['policyNet'],
    cards: ['policyNet'],
  },

  /* ── §7 ─────────────────────────────────────────────────────────────── */
  {
    id: 's07',
    no: '7',
    title: 'The credit assignment problem',
    short: 'Credit assignment',
    slides: '26–29',
    read: [
      'In RL, the only guidance the agent gets is through ***rewards***, and rewards are typically **sparse and delayed** (slide 26). If the pole fell after 100 steps, surely the last action at step 100 is not entirely responsible. This is the ***credit assignment problem***: when the agent gets a reward, it is hard for it to know which actions should get credited (or blamed) for it.',
      'A common strategy is to evaluate an action based on the **sum of all the rewards that come after it**, usually applying a ***discount rate*** $\\gamma$ at each step. For example, if $\\gamma = 0.8$ and the rewards for the next 3 steps are 10, 0 and −50, the total score at the current step is:',
      { eq: { name: 'Slide 26’s worked example', tex: '10 + \\gamma \\times 0 + \\gamma^2 \\times (-50) = -22', read: 'with γ = 0.8: 10 + 0 − 0.64 × 50 = 10 − 32 = −22' } },
      '**Figure 18-6 (slide 27)** works it backwards. The agent goes Right three times and gets +10, 0 and −50. The last action’s sum of discounted future rewards is −50; the one before is $0 + 0.8 \\times (-50) = -40$; the first is $10 + 0.8 \\times (-40) = -22$. Each step passes 80% of what follows back to the step before: the “discount ratio”.',
      '**Choosing $\\gamma$ (slide 28).**',
      { list: [
        'If $\\gamma$ is close to **0**, future rewards won’t count for much compared to immediate rewards.',
        'If $\\gamma$ is close to **1**, rewards far into the future count almost as much as immediate rewards.',
        'Typical discount rates are **0.95** or **0.99**. With $\\gamma = 0.95$, rewards **13 steps** into the future count roughly half as much as immediate rewards ($0.95^{13} \\approx 0.5$); with $\\gamma = 0.99$, rewards **69 steps** into the future count half as much.',
        'In CartPole, actions have fairly short-term effects, so a discount rate of **0.95** seems reasonable.',
      ] },
      '**Action advantage (slide 29).** A good action may be followed by several bad actions that make the pole fall quickly, so the good action gets a low score. But if we play the game many times, on average good actions get a better score than bad ones. So, to get fairly reliable action scores, we **run many episodes** and **normalize all the action scores** (subtract the mean and divide by the standard deviation). This gives a ***normalized score*** for the action taken at each time step, also called the ***action advantage***. Actions with a **negative advantage** were probably bad; actions with a **positive advantage** were good.',
      { slideNote: 'The deck gives $\\gamma$ three names: the text says “discount rate” (slides 26–28), Figure 18-6 labels its 80% the “Discount ratio”, and the code calls it `discount_factor` (slides 34–35). They are the same number.' },
    ],
    play: ['returns', 'advantage'],
  },

  /* ── §8 ─────────────────────────────────────────────────────────────── */
  {
    id: 's08',
    no: '8',
    title: 'Policy gradients: REINFORCE',
    short: 'REINFORCE',
    slides: '30–31',
    read: [
      '***Policy gradients*** (PG) algorithms optimize the parameters of a policy by **following the gradients toward higher rewards** (slide 30). One popular class of PG algorithms, called ***REINFORCE algorithms***, was introduced back in 1992[^1] by Ronald Williams. A common variant of the REINFORCE algorithms:',
      { list: [
        '**1.** Let the neural network policy play the game several times, and at each step **compute the gradients** that would make the chosen action even more likely, but **don’t apply these gradients yet**.',
        '**2.** Once you have run several episodes, **compute each action’s score** (the ***action advantage*** of [§7](#s07)).',
        '**3.** If an action’s score is **positive**, the action was good, and you want to apply the gradients computed earlier to make it even more likely to be chosen in the future. If the score is **negative**, the action was bad, and you want to apply the **opposite** gradients to make it slightly less likely in the future (slide 31). The solution is simply to **multiply each gradient vector by the corresponding action’s score**.',
        '**4.** Finally, **compute the mean of all the resulting gradient vectors**, and use it to perform a gradient descent step.',
      ] },
      { note: 'Slide 15 calls this gradient **ascent** (toward higher rewards), and step 4 a gradient **descent** step. Both hold: in the code ([§9](#s09)) the optimizer descends a loss whose gradients have first been multiplied by the action scores, so each step moves the policy toward higher rewards.', label: 'Ascent or descent?' },
    ],
    play: ['reinforce'],
  },

  /* ── §9 ─────────────────────────────────────────────────────────────── */
  {
    id: 's09',
    no: '9',
    title: 'Implementing policy gradients in tf.keras',
    short: 'PG in tf.keras',
    slides: '32–37',
    read: [
      'Slides 32–37 train the network of Figure 18-5 for CartPole with REINFORCE. **One step (slide 32):** `play_one_step` asks the model for the probability of going left, samples an action, works out the loss and its gradients, then plays the action:',
      { code: { src: 'PLAY_ONE_STEP', label: 'slide 32' } },
      '`action` is True (1, right) when a uniform random number is greater than `left_proba`, so the agent goes right with probability $1 - p$ and left with probability $p$. Since we act **as though the chosen action is the best possible action**, the target probability must be **1.0** if the chosen action is action 0 (left) and **0.0** if it is action 1 (right). Hence the line:',
      { code: { src: 'Y_TARGET', label: 'slide 32' } },
      'The loss compares that target with `left_proba`; its gradients would make the chosen action more likely. They are returned, not applied: REINFORCE’s step 1.',
      '**Many episodes (slide 33).** `play_multiple_episodes` plays `n_episodes` episodes of at most `n_max_steps` steps, and returns every step’s reward and gradients, grouped by episode:',
      { unfold: { label: 'Slide 33: play_multiple_episodes', blocks: [{ code: { src: 'PLAY_MULTIPLE', label: 'slide 33' } }] } },
      '**Scores (slide 34).** `discount_rewards` computes each step’s sum of discounted future rewards by walking backwards through an episode; `discount_and_normalize_rewards` does it for every episode, then normalizes all the scores together (subtract the mean, divide by the standard deviation): the action advantages of [§7](#s07).',
      { code: { src: 'DISCOUNT', label: 'slide 34' } },
      '**Hyperparameters (slide 35):** 150 training iterations, 10 episodes per update, at most 200 steps per episode, a discount factor of 0.95, the Nadam optimizer with learning rate 0.01, and binary cross-entropy as the loss (the model has one sigmoid output).',
      { unfold: { label: 'Slide 35: the hyperparameters', blocks: [{ code: { src: 'PG_HYPER', label: 'slide 35' } }] } },
      '**The training loop (slide 36).** Each iteration plays 10 episodes, normalizes their rewards, and for each trainable variable takes the mean of every step’s gradient multiplied by its action’s score (REINFORCE’s steps 3 and 4). Then the optimizer applies the mean gradients:',
      { code: { src: 'PG_LOOP', label: 'slide 36' } },
      'The `print` statement shows `Iteration: 150/150, mean rewards: 190.3`. Slide 37: “This is a very impressive performance. The algorithm on average is able to balance the pole for **190.3** time steps!!!” (compare 41.698 for `basic_policy`).',
      { unfold: { label: 'Slide 37: watching the trained policy', blocks: [
        'The last thing is to view the animation. `show_one_episode` takes in the policy and plays the CartPole game; at each step an image is rendered, and at the end of the game the list of images is passed to `matplotlib.animation.FuncAnimation` to show the animation (see the Jupyter notebook for Chapter 18 from the author, Géron, and the demo video `cits5017-lect09-demo-CartPole3_using-NN-policy-gradients.webm`).',
        { code: { src: 'SHOW_EPISODE', label: 'slide 37' } },
      ] } },
      { note: 'This page ran slides 25 and 32–36 as written (TensorFlow 2.21, Keras 3.15.1, the slides’ seeds, 150 iterations, 8.5 minutes on a CPU): iteration 150 printed **199.1** (the slides: 190.3), and the trained policy kept the pole up for 197.8 steps on average over 20 new episodes. One line had to change: `env.step(int(action))` fails under NumPy 2.5.2 with “only 0-dimensional arrays can be converted to Python scalars”, because `action` is a 1 × 1 tensor; `int(action[0, 0])` fixed it. The second lab also trains the same algorithm in this browser, on this page’s CartPole port.', label: 'This page’s own runs' },
      { slideNote: 'Slide 34’s text says “`rewards` and `discount_rate` parameter values”, but the parameter is `discount_factor`, and the promised check isn’t shown. The “{” in slide 36’s `# extra code { displays …` is a typesetting artefact for an en dash, written “–” here. Slide 37 writes `matplotlib.anomation.FuncAnimation` (for `animation`) and calls `show_one_episode(pg_policy)`, but `pg_policy` and `show_one_episode` are never defined on the slides. The 190.3 is the mean over the **final** iteration’s 10 episodes, and every episode is capped at 200 steps.' },
    ],
    play: ['yTarget', 'trainPG'],
    cards: ['playOneStep', 'discount', 'pgLoop'],
  },

  /* ── §10 ────────────────────────────────────────────────────────────── */
  {
    id: 's10',
    no: '10',
    title: 'Markov chains',
    short: 'Markov chains',
    slides: '38–40',
    read: [
      'PG algorithms try to directly optimize the policy to increase rewards. The algorithms we look at now are **less direct** (slide 38): the agent learns to estimate the **expected sum of discounted future rewards** for each state, or for each action in each state, then uses this knowledge to decide how to act. To understand them, we first need ***Markov decision processes*** (MDPs), and before them, Markov chains.',
      'In the early 20th century, the mathematician Andrey Markov studied stochastic processes with no memory, called **Markov chains** (slide 39). Such a process has a **fixed number of states**, and it randomly evolves from one state $s$ to another $s\'$ at each step with a **fixed probability**. That probability depends **only on the pair $(s, s\')$**, not on past states: the system has no memory.',
      '**Figure 18-7** has four states. From $s_0$: stay with probability 0.7, go to $s_1$ with 0.2, to $s_3$ with 0.1. From $s_1$: go to $s_2$ with 0.9, to $s_3$ with 0.1. From $s_2$: always back to $s_1$ (1.0). From $s_3$: always back to itself (1.0), so once the chain reaches $s_3$ it stays there forever.',
      'A ***state transition matrix*** describes a Markov chain (slide 40). For Figure 18-7:',
      { eq: { name: 'Figure 18-7’s state transition matrix (slide 40)', tex: '\\begin{bmatrix} 0.7 & 0.2 & 0.0 & 0.1 \\\\ 0.0 & 0.0 & 0.9 & 0.1 \\\\ 0.0 & 1.0 & 0.0 & 0.0 \\\\ 0.0 & 0.0 & 0.0 & 1.0 \\end{bmatrix}', read: 'row = the state you are in, column = the state you go to' } },
      'The **row** indices represent the ***source states*** and the **column** indices the ***destination states***, both in the order $s_0, s_1, s_2, s_3$. In a state transition matrix, **each row contains probabilities that sum to 1**.',
      { slideNote: 'Slide 40’s example, “(row 2, column 3) has probability = 0.9, denoting the state transition from state $s_1$ to $s_2$”, counts rows and columns **from 1** while the states count **from 0**: row 2 is $s_1$ and column 3 is $s_2$. Counted from 0 (like the states, and like Python), the 0.9 sits in row 1, column 2.' },
    ],
    play: ['markov'],
  },

  /* ── §11 ────────────────────────────────────────────────────────────── */
  {
    id: 's11',
    no: '11',
    title: 'MDPs, the Bellman optimality equation, value iteration',
    short: 'MDPs & value iteration',
    slides: '41–44',
    read: [
      '***Markov decision processes*** were first described in the 1950s by Richard Bellman (slide 41). They resemble Markov chains, with a twist: at each step, an agent **can choose one of several possible actions**, and the transition probabilities **depend on the chosen action**. Moreover, some state transitions **return a reward** (positive or negative), and the agent’s goal is to find a policy that will **maximize rewards over time**.',
      '**Figure 18-8**, this lecture’s second running example, has three states and three actions $a_0$, $a_1$, $a_2$:',
      { list: [
        'In $s_0$: $a_0$ stays in $s_0$ with probability 0.7 (reward **+10**) or goes to $s_1$ with 0.3; $a_1$ stays in $s_0$ (1.0); $a_2$ stays with 0.8 or goes to $s_1$ with 0.2.',
        'In $s_1$: $a_0$ stays in $s_1$ (1.0); $a_2$ goes **through the fire** to $s_2$ (1.0, reward **−50**).',
        'In $s_2$: only $a_1$ is possible. It goes to $s_0$ with 0.8 (reward **+40**), to $s_1$ with 0.1, or stays in $s_2$ with 0.1.',
      ] },
      'Which strategy gains the most reward over time (slide 42)? In $s_0$, $a_0$ is clearly the best option (to gain the +10). In $s_1$ it isn’t obvious whether to stay put ($a_0$) or go through the fire ($a_2$). In $s_2$ the only available action is $a_1$, which will most likely lead back to $s_0$ with the large reward of +40.',
      'Bellman proposed a recursive equation, the ***Bellman Optimality Equation***: *the optimal value of the current state is equal to the reward it will get on average after taking one optimal action, plus the expected optimal value of all possible future states that this action can lead to* (slide 42).',
      { eq: { name: 'The Bellman Optimality Equation (slide 43)', tex: "V^*(s) = \\max_a \\sum_{s'} T(s, a, s') \\left[ R(s, a, s') + \\gamma V^*(s') \\right] \\quad \\text{for all } s", read: 'best action’s average of (reward + discounted optimal value of where you land)' } },
      { list: [
        '$V^*(s)$ is the ***optimal state value*** of the state $s$.',
        '$T(s, a, s\')$ is the transition probability from state $s$ to $s\'$, given that the agent chose action $a$.',
        '$R(s, a, s\')$ is the reward the agent gets when it goes from $s$ to $s\'$, given that it chose action $a$.',
        '$\\gamma$ is the ***discount rate*** (a number in the range 0..1).',
      ] },
      'The recursive equation can be implemented iteratively with the ***value iteration*** algorithm. A remarkable result: given enough iterations, it is **guaranteed to converge to the optimal state values** for all the states, corresponding to the optimal policy (slide 43).',
      { eq: { name: 'Value iteration (slide 44)', tex: "V_{k+1}(s) \\leftarrow \\max_a \\sum_{s'} T(s, a, s') \\left[ R(s, a, s') + \\gamma V_k(s') \\right] \\quad \\text{for all } s", read: 'the same right-hand side, using the previous iteration’s estimates' } },
      'Here $V_k(s)$ is the estimated value of state $s$ at the $k^{\\text{th}}$ iteration. This algorithm is an example of ***dynamic programming***: it breaks a complex problem (estimating a potentially infinite sum of discounted future rewards) into tractable subproblems that can be tackled iteratively (finding the action that maximizes the average reward plus the discounted next state value).',
      { slideNote: 'Slide 42 says $a_1$ in $s_2$ “will most likely lead the system back to state $s_1$ or back to $s_0$ with a large reward of +40”. In Figure 18-8 (and slide 47’s lists) it goes to $s_0$ with probability 0.8, to $s_1$ with only 0.1, and back to $s_2$ with 0.1: the likely outcome is $s_0$.' },
    ],
    play: ['valueIter'],
  },

  /* ── §12 ────────────────────────────────────────────────────────────── */
  {
    id: 's12',
    no: '12',
    title: 'Q-values and Q-value iteration',
    short: 'Q-value iteration',
    slides: '45–49',
    read: [
      'Knowing the optimal state values is useful for evaluating a policy, but it **doesn’t tell the agent explicitly which action to take** in each state (slide 45). Bellman found a very similar algorithm to estimate the optimal ***state-action values***, generally called the ***Q-Values***. The optimal Q-value of the state-action pair $(s, a)$, written $Q^*(s, a)$, is:',
      '*the sum of discounted future rewards the agent can expect on average after it reaches the state $s$ and chooses action $a$, but before it sees the outcome of this action, assuming it acts optimally after that action.*',
      'Start by initializing all the Q-value estimates to zero, then update them with the ***Q-value iteration algorithm*** (slide 46):',
      { eq: { name: 'Q-value iteration (slide 46)', tex: "Q_{k+1}(s,a) \\leftarrow \\sum_{s'} T(s,a,s') \\left[ R(s,a,s') + \\gamma \\max_{a'} Q_k(s',a') \\right] \\quad \\text{for all } (s,a)", read: 'average over where you land of (reward + discounted best Q-value there)' } },
      'Once you have the optimal Q-values, the ***optimal policy*** $\\pi^*(s)$ is easy to define: when the agent is in state $s$, it should choose the action with the **highest Q-value** for that state.',
      { eq: { name: 'The optimal policy (slide 46)', tex: '\\pi^*(s) = \\operatorname*{argmax}_{a} Q^*(s,a)', read: 'in each state, pick the action with the largest Q-value' } },
      '**Applying it to Figure 18-8 (slides 47–48).** First define the MDP as three lists, indexed `[s][a][s\']`; `None` marks an action that is impossible in that state:',
      { code: { src: 'MDP_DEF', label: 'slide 47' } },
      'Then initialize all the Q-values to 0 (or to $-\\infty$ for the impossible actions) and run 50 iterations with $\\gamma = 0.90$:',
      { code: { src: 'QVI_LOOP', label: 'slide 48' } },
      '**The result (slide 49):**',
      { code: { src: 'QVI_OUT', label: 'slide 49 · γ = 0.90' } },
      'In $s_0$, action $a_0$ is the optimal action; in $s_1$, take $a_0$ (stay put); in $s_2$ there is only one possible action, $a_1$. If we change the discount factor $\\gamma$ to **0.95** and rerun the code:',
      { code: { src: 'QVI_OUT95', label: 'slide 49 · γ = 0.95' } },
      'The optimal action at $s_1$ becomes $a_2$: **going into the fire!** With the larger $\\gamma$, the future +40 rewards that $s_2$ leads to count for more, enough to outweigh the −50 (this page’s reading of the equation; the lab finds the switch at $\\gamma \\approx 0.948$).',
      { slideNote: 'Running slide 48’s loop as written (50 iterations) gives $Q(s_0, a_1) = 17.0270270245$, which NumPy prints as 17.02702702; slide 49 prints **17.02702703**. Every other value matches to the printed digits. The fully converged value is $630/37 = 17.027027027\\ldots$, which does round to 17.02702703, so the slide’s run was probably slightly more converged (or rounded differently); 50 iterations leave it $2.5 \\times 10^{-9}$ short. Nothing else depends on that digit.' },
    ],
    play: ['qTable'],
    cards: ['qvi'],
  },

  /* ── §13 ────────────────────────────────────────────────────────────── */
  {
    id: 's13',
    no: '13',
    title: 'Temporal difference learning',
    short: 'TD learning',
    slides: '50–52',
    read: [
      'RL problems with discrete actions can be modelled as MDPs, but the agent often **doesn’t know the transition probabilities** (it doesn’t know $T(s, a, s\')$) or **what the rewards are going to be** (it doesn’t know $R(s, a, s\')$) (slide 50). It must experience each state and each transition **at least once** to know the rewards, and go through each state **multiple times** to get a reasonable estimate of the transition probabilities.',
      'The ***temporal difference*** (**TD**) learning algorithm is very similar to the ***Q-value iteration algorithm***, but tweaked to take into account that the agent has only **partial knowledge** of the MDP (slide 51). For example, the agent may use a random ***exploration policy*** to explore the MDP. The TD learning algorithm updates the estimates of the state values based on the transitions and rewards that are **actually observed**:',
      { eq: { name: 'TD learning (slide 51)', tex: "V_{k+1}(s) \\leftarrow (1-\\alpha) V_k(s) + \\alpha \\left( r + \\gamma V_k(s') \\right)", read: 'move the old estimate a fraction α of the way toward r + γ V(s′)' } },
      { eq: { name: 'or equivalently (slide 51)', tex: "V_{k+1}(s) \\leftarrow V_k(s) + \\alpha\\, \\delta_k(s, r, s') \\quad \\text{with} \\quad \\delta_k(s, r, s') = r + \\gamma V_k(s') - V_k(s)", read: 'old estimate + α × (the error)' } },
      'Here $\\alpha$ is the **learning rate**; $r + \\gamma V_k(s\')$ is called the ***TD target***, and $\\delta_k(s, r, s\')$ is called the ***TD error***.',
      'TD learning has many similarities with **stochastic gradient descent**, including the fact that it handles **one sample at a time** (slide 52). Just like SGD, it can only truly converge if you **gradually reduce the learning rate**; otherwise it will keep bouncing around the optimum. For each state $s$, the algorithm keeps track of a **running average** of the immediate rewards the agent gets upon leaving that state, plus the rewards it expects to get later, assuming it acts optimally.',
      { slideNote: 'Slide 51 says TD learning is “very similar to the Q-value iteration algorithm”, but the update it shows is for state values $V_k(s)$, the counterpart of value iteration ([§11](#s11)); slide 52 then says it bounces around “the optimum Q-values”. The update has no max over actions, so “assuming it acts optimally” describes the goal rather than this formula. The Q-value version is Q-learning, [§14](#s14).' },
    ],
    play: ['td'],
  },

  /* ── §14 ────────────────────────────────────────────────────────────── */
  {
    id: 's14',
    no: '14',
    title: 'Q-learning, off- vs on-policy, and ε-greedy',
    short: 'Q-learning & ε-greedy',
    slides: '53–57',
    read: [
      'The ***Q-learning algorithm*** is an adaptation of the ***Q-value iteration algorithm*** to the situation where the transition probabilities and the rewards are **initially unknown** (slide 53). It works by **watching an agent play** and gradually improving its estimates of the Q-values. Once it has Q-value estimates close enough, the optimal policy is to choose the action with the highest Q-value (i.e. the **greedy policy**). The update, from each observed reward $r$ and next state $s\'$:',
      { eq: { name: 'Q-learning (slide 53)', tex: "Q_{k+1}(s,a) \\leftarrow (1-\\alpha) Q_k(s,a) + \\alpha \\left( r + \\gamma \\max_{a'} Q_k(s', a') \\right)", read: 'move Q(s, a) a fraction α toward r + γ × the best Q-value of the next state' } },
      'Here $\\alpha$ is the learning rate (e.g. 0.01). For each state-action pair $(s, a)$, the algorithm keeps track of a running average of the rewards $r$ the agent gets upon leaving state $s$ with action $a$, plus the rewards it expects to get later. Since the target policy would act optimally, we take the **maximum** of the Q-value estimates for the next state.',
      '**Figure 18-9 (slide 54)** compares the learning curves of $Q(s_0, a_0)$ with $\\gamma = 0.9$: Q-value iteration (left) converges very quickly, in **fewer than 20 iterations**; Q-learning (right) takes **about 8,000 iterations**, overshooting before it settles. Not knowing the transition probabilities or the rewards makes finding the optimal policy significantly harder. Slide 55’s chart does the same for $Q(s_2, a_1)$: Q-learning took much longer to converge to the ground-truth value.',
      '**Off-policy and on-policy (slide 56).** Q-learning is an ***off-policy*** algorithm: the policy being trained is not necessarily the one used during training. The Policy Gradients algorithm is ***on-policy***: it explores the world using the policy being trained. It is somewhat surprising that Q-learning can learn the optimal policy by just watching an agent act **randomly** (imagine learning to play golf when your teacher is a drunk monkey). For on-policy algorithms, we need good **exploration policies**, since the space of the “world” is usually huge.',
      '**The $\\epsilon$-greedy policy (slide 57).** Q-learning can work only if the ***exploration policy*** explores the MDP thoroughly. A purely random exploration policy would guarantee visiting all the states many times, but it may take a long time. A better option is the ***$\\epsilon$-greedy policy***: with probability $\\epsilon$ it explores randomly, and with probability $1 - \\epsilon$ it greedily chooses the action with the highest Q-value. $\\epsilon$ is often set **close to 1 initially** and **gradually reduced** to a small value (e.g. **0.05**) over time, so the algorithm explores at first and becomes greedier as it learns.',
      { slideNote: 'Slides 56 and 57 tie exploration to different algorithms. Slide 56: “For on-policy algorithms, we need good exploration policies since the space of the ‘world’ is usually huge.” Slide 57, about Q-learning (off-policy): “Q-Learning can work only if the exploration policy explores the MDP thoroughly.” Both hold: an off-policy learner still has to see enough of the MDP. Slide 56 also says “the Q-Learning algorithm that we have just implemented”, but the slides show no Q-learning code (the lab runs its own). Slide 54 typesets the number as “8, 000”. Slide 53 ends its sentence “(i.e., the greedy policy):” and then gives the update rule, not a policy, and it uses “target policy” without defining it. Neither chart (slides 54–55) says what its dashed line is (it sits at the converged value), and on slide 55 the Q-learning curve is still just below it at 10,000 iterations; slide 55’s chart has no figure number.' },
    ],
    play: ['qLearning', 'epsilon'],
  },

  /* ── §15 ────────────────────────────────────────────────────────────── */
  {
    id: 's15',
    no: '15',
    title: 'Approximate Q-learning',
    short: 'Approximate Q-learning',
    slides: '58–60',
    read: [
      'The main problem with Q-learning is that it **does not scale well** to large (or even medium) MDPs with many states and actions: the number of parameters can be too large to be manageable (slide 58). The solution is to find a function $Q_\\theta(s, a)$ that **approximates** the Q-value of any state-action pair $(s, a)$ using a manageable number of parameters (given by the parameter vector $\\theta$). This is called ***Approximate Q-Learning***.',
      'For years it was recommended to use **linear combinations of hand-crafted features** extracted from the state (e.g. for **Ms. Pac-Man**: the distance of the closest ghosts, their directions, and so on) to estimate Q-values. But recent research, especially from DeepMind, showed that **deep neural networks** can work much better, and don’t require any feature engineering (slide 59). A DNN trained to estimate the Q-values is a ***deep Q-network*** (**DQN**); using a DQN for Approximate Q-Learning is called ***Deep Q-Learning***.',
      '**The target (slide 60).** Given a state-action pair $(s, a)$, we want the approximate Q-value to be **as close as possible** to the reward $r$ we actually observe after playing action $a$ in state $s$, plus the discounted future rewards. To estimate those future rewards, execute the DQN on the **next state** $s\'$, for all possible actions $a\'$; select the highest, discount it by $\\gamma$, and add the reward $r$. That gives the target Q-value:',
      { eq: { name: 'The target Q-value (slide 60, Eq. 18-7)', tex: "y(s,a) = r + \\gamma \\max_{a'} Q_{\\boldsymbol{\\theta}}(s',a')", read: 'reward now + discounted best Q-value the DQN predicts for the next state' } },
      'With this target, run a training step with any gradient descent algorithm to **minimize the squared error or the Huber loss** between $Q_{\\boldsymbol{\\theta}}(\\cdot,\\cdot)$ and the target Q-value. And that is the ***deep Q-learning algorithm***!',
      { slideNote: 'Slide 60 says that adding the discounted maximum to the reward $r$ “gives us the approximate Q-value”, but that sum is the **target** $y(s, a)$ that the approximation $Q_{\\boldsymbol{\\theta}}(s, a)$ is trained toward, as the next line says.' },
    ],
    play: ['approx'],
  },

  /* ── §16 ────────────────────────────────────────────────────────────── */
  {
    id: 's16',
    no: '16',
    title: 'Deep Q-learning in tf.keras',
    short: 'DQN in tf.keras',
    slides: '61–64',
    read: [
      '**The DQN (slide 61)** takes a state (CartPole’s 4 observation numbers) and outputs **one Q-value per action**: two `Dense(32, activation="elu")` layers, then `Dense(n_outputs)` with no activation. `epsilon_greedy_policy` explores with probability `epsilon`, otherwise it picks the action whose predicted Q-value is highest. The agent also needs a ***replay buffer*** of its experiences: a `deque` holding at most 2,000 of them.',
      { code: { src: 'DQN_MODEL', label: 'slide 61' } },
      '**Sampling and playing (slide 62).** `sample_experiences` picks `batch_size` random experiences from the replay buffer and returns them as 6 NumPy arrays: states, actions, rewards, next states, dones and truncateds. `play_one_step` chooses an action with the $\\epsilon$-greedy policy, plays it, and appends the experience to the replay buffer.',
      { code: { src: 'DQN_SAMPLE', label: 'slide 62' } },
      '**One training step (slide 63)** with a batch of 32, a discount factor of 0.95 and Nadam (learning rate $10^{-2}$): predict the Q-values of the **next** states, keep each one’s maximum, and build the target $r + \\gamma \\max_{a\'} Q_\\theta(s\', a\')$ of [§15](#s15). `runs = 1.0 - (dones | truncateds)` is 0 when the episode ended at that step, which **drops the future term** there. Then, under the tape, the one-hot `mask` keeps only the Q-value of the action actually taken, and the loss is the mean squared error between the targets and those Q-values.',
      { code: { src: 'DQN_TRAIN_STEP', label: 'slide 63' } },
      '**Training (slide 64):** 600 episodes of at most 200 steps. $\\epsilon$ falls linearly from 1 to 0.01 (`max(1 - episode / 500, 0.01)`); after episode 50, each episode ends with one training step; the weights of the best episode so far are kept and restored at the end.',
      { code: { src: 'DQN_LOOP', label: 'slide 64' } },
      { slideNote: 'Slide 61’s comment says the buffer holds tuples “(obs, action, reward, next_obs, done)”, but `play_one_step` appends 6 fields, adding `truncated`, and `sample_experiences` returns 6 arrays. Slide 62’s new `play_one_step(env, state, epsilon)` reuses the name of slide 32’s `play_one_step(env, obs, model, loss_fn)`. Slide 60 allows the squared error or the Huber loss; slide 63 uses `tf.keras.losses.mean_squared_error`, which this page’s run (Keras 3.15.1) rejects with an AttributeError: `tf.keras.losses.mse` is the same loss under its current name. Slide 57’s $\\epsilon$ falls to “e.g. 0.05”, slide 64’s code to 0.01: both are fine. The “{” in slide 64’s last comment is the same en-dash artefact as slide 36 (written “–”), and that line runs off the slide at “weight”. `rewards.append(step)` stores the step index (the episode’s length − 1), which slide 65 plots as “Sum of rewards”.' },
    ],
    play: ['replay', 'trainStep', 'epsSchedule'],
    cards: ['epsGreedy', 'sample', 'trainingStep', 'dqnLoop'],
  },

  /* ── §17 ────────────────────────────────────────────────────────────── */
  {
    id: 's17',
    no: '17',
    title: 'DQN results, catastrophic forgetting, and why RL is hard',
    short: 'Results & forgetting',
    slides: '65–67',
    read: [
      'Slide 65 shows the lecturer’s output from slide 64’s code, `Episode: 600, Steps: 100, eps: 0.010`, and plots the `rewards` list it saved:',
      { unfold: { label: 'Slide 65: plotting the rewards', blocks: [{ code: { src: 'DQN_PLOT', label: 'slide 65' } }] } },
      'The chart (“Sum of rewards” against “Episode”, 0–600) stays low for the first couple of hundred episodes, then rises into a jagged band that reaches the 200 ceiling many times, then falls back to around 100–125 for the last episodes. The slide notes that **this run was much worse than the textbook’s**.',
      { note: 'This page ran slides 61–64 as written (TensorFlow 2.21; the slides set no seed, so 42 was used; `mse` for slide 63’s loss) until its 21-minute time box stopped it after **564 of 600** episodes. It shows the same story: a slow start while $\\epsilon$ is high, a first full 200-step episode at episode 337, a stretch near the maximum from about episode 425 to 500, then a drop to about 120–150 (episodes 500–550) before it recovers. Played greedily, its best weights averaged 143.9 steps over 20 new episodes. The lab charts this run.', label: 'This page’s own run' },
      'Slide 66: the algorithm took a while to start learning anything, in part because $\\epsilon$ was very high at the beginning. It first reached the max reward at around episode **290**, but immediately dropped, then bounced up and down a few times; soon after it looked like it had finally stabilized near the max reward, at around episode **550**, its score again dropped dramatically. At the last episode the reward was only **100**. This is called ***catastrophic forgetting***, and it is one of the big problems facing virtually all RL algorithms. (In the demo video `cits5017-lect09-demo-CartPole4_using-DQN-epsilon-greedy-policy.webm` the pole tilted over at step 143, “which is still not too bad”.)',
      '**Conclusion (slide 67).** Reinforcement learning is **notoriously difficult**, largely because of the **training instabilities** and the **huge sensitivity to the choice of hyperparameter values and random seeds**. Many state-of-the-art RL algorithms were trained with **millions of steps** for long periods of time, and the learning rate was set to drop extremely slowly.',
      'Géron’s closing sentence, quoted on slide 67: “Reinforcement learning is a huge and exciting field, with new ideas and algorithms popping out every day, so I hope this chapter sparked your curiosity: there is a whole world to explore!”',
      { slideNote: 'Slide 66’s story doesn’t match slide 65’s chart (read by eye: no values are printed). The chart first touches 200 at about episode 265 (slide 66: around 290). After about episode 390 it never returns to 200, so there is no stable stretch near the max before 550; its big fall is around episodes 390–420, with single-episode plunges near 429, 450 and 483. The output’s “Steps: 100” means the last saved `step` is 99, yet the plotted line ends near 125. Slide 66 may describe a different run.' },
    ],
    play: ['dqnCurve'],
    cards: ['dqnPlot'],
  },

  /* ── §18 ────────────────────────────────────────────────────────────── */
  {
    id: 's18',
    no: '18',
    title: 'Summary',
    short: 'Summary',
    slides: '68–69',
    read: [
      'Slide 68’s outcomes: understand when to apply **reinforcement learning** (know its applications); understand the concept of **rewards** in RL; understand **policy search** and **policy gradients** in RL; know how to use the **OpenAI Gym** toolkit to train a NN for a simple game, such as **CartPole**; understand the concept of **action evaluation** (the credit assignment problem) and **discounted rewards**; understand **Markov Decision Processes** (MDP); understand **Q-learning**, the **$\\epsilon$ greedy policy**, **approximate Q-learning**, and **deep Q-learning**; and know how to implement a **deep Q-learning network** for a simple problem.',
      'Tick each outcome below when you can explain it without the page.',
      'Slide 69: “This is the last topic of the unit. I hope you enjoyed all the topics as much as I did. Good luck for the exam! Have a good week.”',
    ],
    play: ['outcomes'],
  },
];
