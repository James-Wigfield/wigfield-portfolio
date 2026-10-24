# CITS5017 Deep Learning

Topic 9: Reinforcement Learning — Associate Professor Du Huynh (Unit Coordinator and Lecturer) — Semester 2, 2026

*Transcription conventions (slides 1–69): key terms that are dark red on the slides are written in **bold** (dark-red italic → ***bold italic***); black italic stays *italic*; black bold text is flagged in a note where it occurs. Maths that is typeset in blue on the slides is written as plain LaTeX (numbers that the slides set in blue maths type, e.g. $500$, are written as `$...$` too). Greek letters are written as typeset: the discount rate is $\gamma$, and the lunate epsilon of slide 3 is $\epsilon$. Bold blue sub-headings directly under a slide title are written as `###` headings. Inline code and file names that are dark-red typewriter on the slides are written as `code`. Code blocks (black typewriter on a light-grey box) are transcribed with the exact column positions of the slides' monospaced text (measured from 400-dpi renders); typos in code are kept. Footnote markers in the text are written as <sup>N</sup>. Curly quotation marks and apostrophes are written as straight ones. The one underlined phrase in the deck's first half (slide 26) is written with `<u>…</u>`. Figures are described in `> **Figure N-M.**` blockquotes. Slide-number footers ("N / 69") are not recorded.*

---

## Slide 1 — CITS5017 Deep Learning / Topic 9: Reinforcement Learning

Associate Professor Du Huynh
(Unit Coordinator and Lecturer)

Semester 2, 2026

> **Figure (slide 1).** Title banner: white text on a dark-blue rectangle, two centred lines: "CITS5017 Deep Learning", "Topic 9: Reinforcement Learning". Below the lecturer/date lines is the UWA crest: a shield whose upper band is blue with a gold top edge and holds two open books, each showing two pages of text — the left book reads "VIT AM" / "EXC OLU", the right book reads "ERE PER" / "AR TES" (i.e. *Vitam excolere per artes*). Below the books, a gold field rises to a point in the centre of the blue shield; on it sits a black swan with a white wing. Beneath the shield is a blue ribbon with white text "SEEK WISDOM". Below the crest is the blue wordmark "THE UNIVERSITY OF / WESTERN / AUSTRALIA". (No slide number is shown on this slide.)

---

## Slide 2 — Today

Chapters 18.

### Hands-on Machine Learning with Scikit-Learn, Keras & TensorFlow

> **Figure (slide 2).** Small book-cover image, O'REILLY. Top-left: red "O'REILLY" logo. Top-right corner: a diagonal grey banner reading "Third Edition". Title in black: "Hands-On Machine Learning with Scikit-Learn, Keras & TensorFlow". Subtitle in orange: "Concepts, Tools, and Techniques to Build Intelligent Systems". Below it, small "powered by" text with a Jupyter logo. Cover illustration: a black salamander with bright yellow-orange spots and stripes, crawling diagonally across the lower half. Author name at bottom right: "Aurélien Géron".

(The book title is large black text, not blue. It wraps after "Scikit-Learn,".)

---

## Slide 3 — Chapter Eighteen

### Reinforcement Learning

Here are the main topics we will cover:

- Introduction to reinforcement learning and its applications
- *Rewards* in RL
- Policy search and policy gradients
- The OpenAI Gym toolkit and training a NN to create policy for the CartPole game
- Evaluating Actions (The Credit Assignment Problem) and discounted rewards
- Markov Decision Processes
- $\epsilon$ greedy policy
- Q-learning, approximate Q-learning, and deep Q-learning

(The sub-heading "Reinforcement Learning" is large black text, not blue, with no gap before "Here are the main topics we will cover:". "Rewards" is black italic. The $\epsilon$ is a blue lunate epsilon; there is no hyphen between it and "greedy".)

---

## Slide 4 — Reinforcement Learning – A Brief Introduction

- **Reinforcement Learning** (**RL**) is one of the most exciting fields of Machine Learning today, and also one of the oldest.
- It has been around since the 1950s, producing many interesting applications over the years, in particular in **games** (e.g., TD-Gammon) and in machine control.
- In 2013, researchers from an English startup called **DeepMind** demonstrated that a system could learn to play just about any Atari game from scratch and eventually outperform humans in most of them, using only raw pixels as inputs and without any prior knowledge of the rules of the games.
- These amazing feats culminated in May 2017 with the victory of their system **AlphaGo** against **Ke Jie**, the world champion of the game of ***Go***.
- Today the whole field of RL is boiling with new ideas, with a wide range of applications. DeepMind was bought by Google for over $500$ million dollars in 2014.

(The dash in the title is an en dash. The parentheses around "RL" are black. "$500$ million" is blue: "500" in maths type, "million" in blue sans-serif text. "Go" is dark-red italic; its full stop is black.)

---

## Slide 5 — How did RL algorithms do that?

With hindsight it seems rather simple: **they applied the power of Deep Learning to the field of Reinforcement Learning**, and it worked beyond their wildest dreams.

In this lecture we will learn the basic concepts behind Reinforcement Learning, including:

1. ***policy gradients***,
2. ***Markov decision processes*** (**MDPs**), and
3. ***Deep Q-network***.

The same techniques can be used for a wide variety of tasks, from walking robots to self-driving cars.

We will use these techniques to train models to balance a pole on a moving cart.

(The list numbers are white digits in small dark-blue squares. "MDPs" is dark red, upright; its parentheses and the trailing punctuation are black.)

---

## Slide 6 — Learning to Optimize Rewards

- In Reinforcement Learning, a software ***agent*** makes ***observations*** and takes ***actions*** within an ***environment***, and in return it receives ***rewards***.
- Its objective is to learn to act in a way that will maximize its expected long-term rewards.
  We can think of positive reward as **pleasure** and negative reward as **pain**. So the agent acts in the environment and learns by trial and error to maximize its pleasure and minimize its pain.

("pleasure" and "pain" are dark red, upright. "We can think of …" continues the second bullet on a new line, with no bullet of its own.)

---

## Slide 7 — Learning to Optimize Rewards (cont.)

### A few examples

> **Figure 18-1 (panels a–b).** Two photos side by side, each in a black frame with a white lower-case letter on a dark square in its top-right corner.
> - *Panel "a":* a six-wheeled planetary rover (Mars-rover style, grey/white body, a camera mast with a box-shaped head on top, a jointed robotic arm reaching right) standing on orange-brown rocky ground, with hazy orange hills and sky behind it.
> - *Panel "b":* a Ms. Pac-Man screen: a dark-blue maze background with salmon-pink wall blocks and rows of small pink dots (pellets); a red ghost near the top centre, a yellow-orange ghost inside the central box (the ghost pen), and yellow Ms. Pac-Man just below the box.

*Caption:* Figure 18-1. Reinforcement Learning examples: (a) robotics, (b) Ms. Pac-Man, (c) Go player, (d) thermostat, (e) automatic trader

(a) The agent can be the program controlling a walking robot, observing the real world environment through sensor readings. Its positive reward could be approaching the target destination and negative reward could be wasting time in the wrong direction or falling down.

(The caption lists all five panels, but only (a) and (b) are shown on this slide. The item label "(a)" is dark blue. The caption wraps after "Ms. Pac-Man,".)

---

## Slide 8 — Learning to Optimize Rewards (cont.)

### A few examples (cont.)

> **Figure 18-1 (panels a–b).** The same two photos as on slide 7: panel "a" (the rover on orange-brown terrain) and panel "b" (the Ms. Pac-Man maze).

*Caption:* Figure 18-1. Reinforcement Learning examples: (a) robotics, (b) Ms. Pac-Man, (c) Go player, (d) thermostat, (e) automatic trader

(b) The agent can be the program controlling Ms. Pac-Man. The environment is a simulation of the Atari game; the actions are the possible joystick positions; observations are the screenshots; the rewards are just the game points.

(The item label "(b)" is dark blue.)

---

## Slide 9 — Learning to Optimize Rewards (cont.)

### A few examples (cont.)

> **Figure 18-1 (panels c–e).** Three photos side by side, each with a white lower-case letter on a dark square in its top-right corner.
> - *Panel "c":* a corner of a wooden Go board (light orange-tan wood, black grid lines). Four black stones (two in the top row, two in the row below) and four white stones (two to the right of the lower black pair, two more below-left), with small black squares and small white squares marking a few intersections around them.
> - *Panel "d":* a round Nest thermostat: a polished steel ring around a black face; "nest" in grey at the top; a blue circular display with "COOLING" in small letters above a large white "75", and a small tick mark with a tiny number near the display's upper right.
> - *Panel "e":* a narrow strip of a stock-ticker image: columns of green, red and white price numbers with up/down triangles (e.g. "+3.34", "4.199", "1.359", "4.259", "5.369", "2.519", "6.319", "3.659", "2.659", "+67.12", "+23.9", "+33", "2.119"), overlaid by a glowing cyan-white zig-zag line chart across the bottom.

*Caption:* Figure 18-1. Reinforcement Learning examples: (a) robotics, (b) Ms. Pac-Man, (c) Go player, (d) thermostat, (e) automatic trader

(c) The agent does not have to control a physically (or virtually) moving thing. e.g., it can be a smart thermostat, getting rewards whenever it is close to the target temperature and saves energy, and negative rewards when humans need to tweak the temperature, so the agent must learn to anticipate human needs.

(The item label "(c)" is dark blue. The thermostat described under "(c)" is panel (d) of the figure.)

---

## Slide 10 — Learning to Optimize Rewards (cont.)

### A few examples (cont.)

> **Figure 18-1 (panels c–e).** The same three photos as on slide 9: panel "c" (Go board), panel "d" (Nest thermostat showing "COOLING" / "75"), panel "e" (stock-ticker numbers with a zig-zag chart).

*Caption:* Figure 18-1. Reinforcement Learning examples: (a) robotics, (b) Ms. Pac-Man, (c) Go player, (d) thermostat, (e) automatic trader

(d) The agent can observe stock market prices and decide how much to buy or sell every second. Rewards are obviously the monetary gains and losses.

(e) The agent may be a program to control a robot to move to get out of a maze. In this case, there is only negative reward and no positive reward. So it had better find the exit as soon as possible!

(The item labels are dark blue. Item "(d)" describes the trader, which is panel (e) of the figure; item "(e)" (the maze) has no panel. The last line runs down to the slide-number footer.)

---

## Slide 11 — Policy Search

- The algorithm used by the software agent to determine its actions is called its ***policy***, e.g., the policy could be a neural network taking observations as inputs and outputting the action to take (see Figure 18-2).

> **Figure 18-2.** Two black-outlined boxes side by side, labelled above them "Agent" (left) and "Environment" (right).
> - *Agent box:* at bottom left, a light-blue cartoon robot (antenna, round eyes, wrench-shaped hands). A small cloud and then a large light-blue thought cloud rise from its head; inside the large cloud is a fully connected neural network of three rows: three **green** neurons at the bottom (inputs), four **blue** neurons in the middle, and three **blue** neurons at the top, with thin black connection lines between adjacent rows. The label "Policy" sits at the lower left of the network.
> - *Actions:* three vertical black lines rise from the top neurons to a horizontal line that runs right, out of the Agent box, and ends in an arrowhead at the Environment box. The label "Actions" sits under this arrow.
> - *Rewards & observations:* a second horizontal line runs from the Environment box back left along the bottom into the Agent box, then turns up into three black upward arrows that point into the three green input neurons. The label "Rewards & observations" (two lines) sits above this line.
> - *Environment box:* a fire (red outer flame, orange middle, yellow core) on the left; on the right a red cylindrical pot or bucket under a grey water tap, with one light-blue drop falling from the tap.

*Caption:* Figure 18-2. Reinforcement Learning using a neural network policy

---

## Slide 12 — Policy Search (cont.)

- The policy can be any algorithm you can think of, and it does not even have to be deterministic. For example, a robotic vacuum cleaner whose reward is the amount of dust it picks up in 30 minutes. Its policy could be:
  - move forward with some probability $p$ every second, or
  - randomly rotate left or right (a random angle between $-r$ and $+r$ degrees) with probability $1 - p$.
- There are ***policy parameters*** that you can tweak. In the vacuum robot above, the policy parameters are $p$ and $r$; because randomness is involved, it is called a ***stochastic policy***. The robot will have an erratic trajectory, which guarantees that it will eventually get to any place it can reach and pick up all the dust.

(The two sub-bullets are in a smaller font than the main bullets.)

---

## Slide 13 — Policy Search (cont.)

### Possible learning algorithms

- One possible learning algorithm would be to find the optimal ***policy parameters*** by trying all the combinations of parameter values in the ***policy space***. This is known as ***policy search*** and this is a **brute force approach**.
  When the policy space is large (which is generally the case), finding a good set of parameters this way is like searching for a needle in a gigantic haystack.

> **Figure 18-3.** Two panels side by side, each inside a grey dotted border.
> - *Left, titled "Policy space":* grey axes with arrowheads; the vertical axis is labelled bold-italic "r" and the horizontal axis bold-italic "p". Four blue dots in a 2 × 2 grid, labelled above each dot: "a" (top left: small $p$, large $r$), "b" (top right: large $p$, large $r$), "c" (bottom left: small $p$, small $r$), "d" (bottom right: large $p$, small $r$).
> - *Right, titled "Resulting behaviors":* four robot-vacuum icons (grey concentric circles with a dark-grey centre and a small bright-green dot), labelled "a", "b", "c", "d", each with a thin grey trajectory that starts at a small grey dot and ends in an arrowhead at the robot:
>   - "a" (top left): a tangled zig-zag of many short segments around a small area next to the robot;
>   - "b" (top right): a few long straight segments forming a large angular loop;
>   - "c" (bottom left): a wandering path of many short wiggly segments;
>   - "d" (bottom right): a few long straight segments crossing much of the panel from its centre to the robot in the bottom-right corner.

*Caption:* Figure 18-3. Four points in policy space (left) and the agent's corresponding behavior (right)

("brute force approach" is dark red, upright. "When the policy space is large …" continues the bullet on a new line. The caption wraps after "(left) and".)

---

## Slide 14 — Policy Search (cont.)

### Possible learning algorithms (cont.)

- Another way to explore the policy space is to use ***genetic algorithms***. For example, you could randomly create a first generation of 100 policies and try them out, then "kill" the 80 worst policies and make the 20 survivors produce 4 offspring each. An offspring is just a copy of its parent.

  The surviving policies plus their offspring together constitute the second generation. You can continue to iterate through generations this way, until you find a good policy.

---

## Slide 15 — Policy Search (cont.)

### Possible learning algorithms (cont.)

- A third approach is to use **optimization techniques**, by evaluating the gradients of the rewards with respect to the policy parameters, then tweaking these parameters by following the gradient toward higher rewards (***gradient ascent***). This approach is called ***policy gradients*** (**PG**), which we will see more detail later.

  For example, in the robot vacuum cleaner, you could slightly increase $p$ and evaluate whether this increases the amount of dust picked up by the robot in 30 minutes; if it does, then increase $p$ some more, or else reduce $p$.

("optimization techniques" and "PG" are dark red, upright; the parentheses are black.)

---

## Slide 16 — Introduction to OpenAI Gym

- To implement a ***policy gradient*** (**PG**) algorithm using TensorFlow, we need to create an environment for the agent to live in. e.g., an Atari game environment for an agent to learn to play an Atari game; a ***simulated environment*** for training a walking robot.
- ***OpenAI gym*** is a toolkit that provides a wide variety of simulated environments (Atari games, board games, 2D and 3D physical simulations, and so on), so you can train agents, compare them, or develop new RL algorithms.
- OpenAI Gym can be installed on Colab:

  ```
  # Only run these commands on Colab or Kaggle!
  %pip install -q -U gymnasium
  ```

  or on your own computer:

  ```
  pip install gymnasium
  ```

(The two code boxes use a much smaller typewriter font than the code on later slides. The key term is "OpenAI gym" with a lowercase "g"; the third bullet has "OpenAI Gym".)

---

## Slide 17 — Introduction to OpenAI Gym

- Example: To create the ***CartPole*** environment using the `make()` function (this is a 2D simulation where the robot can move left or right):

```python
>>> import gymnasium as gym
>>> env = gym.make("CartPole-v1", reader_mode="rgb_array")
>>> obs, info = env.reset(seed=42)
>>> obs
array([ 0.0273956 , -0.00611216, 0.03585979, 0.0197368 ], dtype=float32)
>>> info
{}
```

The four numbers in the observation vector (`obs`) are: **(1)** the cart's horizontal position ($0.0$ = centre), **(2)** its velocity (positive means *right*), **(3)** the angle of the pole ($0.0$ = vertical), and **(4)** its angular velocity (positive means *clockwise*.

> **Figure 18-4.** A side view of the CartPole system. A thin grey horizontal line is the track. On it sits the cart, a black rectangle, slightly left of a short grey tick mark labelled "0" (the track centre). A thin tan/orange pole is hinged at the middle of the cart (a small blue-purple dot at its base) and leans to the **right** of a vertical dashed line drawn up from the hinge; a dashed line also runs along the pole's direction above its tip.
> - "Angle": a small curved arrow at the top, from the vertical dashed line to the pole's dashed extension (pointing right, i.e. clockwise), labelled "Angle".
> - "Angular velocity": a thick black curved arrow right of the pole's tip, curving clockwise and downward, labelled "Angular velocity".
> - "Velocity": a thick black arrow pointing **left** from the cart along the track, labelled "Velocity" above it.
> - "Position": below the track, a vertical dashed line drops from the hinge and another from the "0" tick; a horizontal arrow between them points left from the "0" line to the cart's line, labelled "Position" underneath.

*Caption:* Figure 18-4. The CartPole environment

(The paragraph is fully justified in a left column, with Figure 18-4 to its right; "horizontal" is hyphenated across a line break as "hor-/izontal". "(1)"–"(4)" are black bold. "$0.0$" is blue and the "=" after it is black. "right" and "clockwise" are black italic. The last parenthesis, "(positive means *clockwise*.", is never closed. The `array(...)` output line runs past the right edge of the grey code box. The caption sits at the bottom right, next to the slide number.)

---

## Slide 18 — Introduction to OpenAI Gym

### Rendering the environment

The game environment can be render using the `render()` method and the output image can be displayed using Matplotlib's `imshow()` function:

```python
>>> env.reset()
>>> img = env.render()
>>> img.shape # height, width, channels (3 = Red, Green, Blue)
(400, 600, 3)
>>> plt.imshow(img)
```

> **Figure (slide 18, no number or caption).** The rendered CartPole frame: on a white background, a thin black horizontal line (the track) spans about the middle half of the slide; a black rectangle (the cart) sits on the line at the centre; a tan/orange pole stands exactly vertical from the cart's middle, with a small light-purple circle (the hinge) at its base.

---

## Slide 19 — Introduction to OpenAI Gym

### Useful functions from the OpenAI Gym environment

- `env.action_space` – returns the possible action, e.g., in CartPole example:

  ```python
  >>> env.action_space
  Discrete(2)
  ```

  where $0$ denotes accelerating the robot left and,
  $1$ denotes accelerating the robot right respectively.

(The dash after `env.action_space` is an en dash. On the slide the second line is indented so that its "1" sits directly under the "0" of the first line.)

---

## Slide 20 — Introduction to OpenAI Gym (cont.)

### Useful functions from the OpenAI Gym environment

- `env.step(action)` – performs the specified action once.
  e.g., since the pole is leaning toward the right (`obs[2] > 0`), let's accelerate the cart toward the right:

  ```python
  >>> action = 1 # accelerate right
  >>> obs, reward, done, truncated, info = env.step(action)
  >>> obs
  array([ 0.02727336, 0.18847767, 0.03625453, -0.26141977], dtype=float32)
  >>> reward
  1.0
  >>> done
  False
  >>> truncated
  False
  >>> info
  {}
  ```

(The dash after `env.step(action)` is an en dash; the parentheses around `obs[2] > 0` are black. The `array(...)` output line runs past the right edge of the grey code box.)

---

## Slide 21 — A Simple Hard-coded Policy

Let's try a simple policy:
– accelerate left when the pole is leaning toward the left and
– accelerates right when the pole is leaning toward the right.

We will run this policy to see the average rewards it gets over $500$ episodes:

```python
def basic_policy(obs):
    angle = obs[2]
    return 0 if angle < 0 else 1
```

(The two policy lines start with en dashes, not bullets.)

---

## Slide 22 — A Simple Hard-coded Policy (cont.)

```python
totals = []
for episode in range(500):
    episode_rewards = 0
    obs, info = env.reset(seed=episode)
    for step in range(200):
        action = basic_policy(obs)
        obs, reward, done, truncated, info = env.step(action)
        episode_rewards += reward
        if done or truncated:
            break

    totals.append(episode_rewards)

>>> np.mean(totals), np.std(totals), np.min(totals), np.max(totals)
(41.698, 8.389445512070509, 24.0, 63.0)
```

Using this policy, the average reward is $41.698$; the maximum reward is $63$. That is, this policy never managed to keep the pole upright for more than $63$ steps.

(See `cits5017-lect09-demo-CartPole1_using-basic-hard-coded-policy.webm` for the visualization.)

(`totals.append(episode_rewards)` is indented 4 spaces, i.e. inside the `for episode` loop, after a blank line. The "(See …)" note is in a smaller font.)

---

## Slide 23 — Neural Network Policies

#### Left — figure

> **Figure 18-5.** A small network drawn bottom-to-top.
> - *Observations:* four inputs at the bottom, labelled $x_1$, $x_2$, $x_3$, $x_4$, with the label "Observations" to the right.
> - *Hidden:* four light-blue circles in a row, each showing a black ReLU-like curve (flat, then bending upward). Every input sends a black arrow to every hidden neuron (a vertical arrow to the neuron directly above and diagonal arrows to the other three: 16 arrows in all). Label "Hidden" to the right.
> - *Output:* one light-blue circle with a black S-shaped (sigmoid) curve, receiving one black arrow from each of the four hidden neurons. Label "Probability of action 0 (left)" to the right.
> - *Multinomial sampling:* an upward arrow from the output neuron into a light-blue open-topped container holding seven balls — five dark-blue and two pale-pink — labelled "Multinomial sampling" to the right.
> - *Action:* an upward arrow from the container to a single dark-blue circle labelled "Action".

*Caption:* Figure 18-5. Neural network policy

#### Right — text

We can train a neural network to create a policy to move the e.g., a network as shown in Figure 18-5:

- The output layer has 1 neuron which outputs the probability $p$ of action $0$ (left).
- We will select an action randomly, according to the estimated probabilities. This ***exploration/exploitation*** dilemma is central in reinforcement learning.
- Note that in this particular environment, the past actions and observations can safely be ignored, since each observation contains the environment's **full state**.

(The bullets on this slide are blue round dots, not the deck's usual dark-blue squares. "full state" is dark red, upright.)

---

## Slide 24 — Neural Network Policies

### Things to consider when building and training your network

- If the observations do not contain the **full state** of the environment, then you may need to consider past actions and observations as well. For example, if the environment only revealed the position of the cart but not its velocity, you would have to consider not only the current observation but also the previous observation in order to estimate the current velocity.
- When the observations are noisy, you generally want to use the past few observations (e.g., by averaging them) to estimate the most likely current state.

("full state" is dark red, upright. The content is vertically centred, leaving a large gap under the title.)

---

## Slide 25 — Neural Network Policies

Python code for the network in Figure 18-5:

```python
import tensorflow as tf

n_inputs = 4        # == env.observation_space.shape[0]

# create the model
tf.random.set_seed(42)
model = tf.keras.models.Sequential([
    tf.keras.layers.Dense(5, activation="relu", input_shape=[n_inputs]),
    tf.keras.layers.Dense(1, activation="sigmoid"),
])

# reset the game environment, for reproducibility
obs, info = env.reset(seed=42)
```

(The Jupyter-Notebook file from the author includes also the animation for the above network with a random policy. See `cits5017-lect09-demo-CartPole2_using-NN-random-policy.webm`)

But how do we train the network?

(The first `Dense` line reaches the right edge of the grey code box. The note in parentheses is in a smaller font; the file name is on its own line.)

---

## Slide 26 — Evaluating Actions: The Credit Assignment Problem

- In RL, the only guidance the agent gets is through ***rewards***, and rewards are typically sparse and delayed; e.g., if the pole fell after $100$ steps, surely the last action at step $100$ is not entirely responsible. This is called the ***credit assignment problem***: when the agent gets a reward, it is hard for it to know which actions should get credited (or blamed) for it.
- To tackle the above problem, a common strategy is to evaluate an action based on the **sum of all the rewards that <u>come after</u> it**, usually applying a ***discount rate*** $\gamma$ at each step.
  E.g., if the discount rate $\gamma = 0.8$ and the reward for the next 3 steps are: $10$, $0$, and $-50$, then the total score at the current step is: $10 + \gamma \times 0 + \gamma^2 \times (-50) = -22$.

("sum of all the rewards that come after it" is dark red, upright, and "come after" is also underlined in dark red. "3" in "next 3 steps" is black text, not maths. The content is vertically centred.)

---

## Slide 27 — Evaluating Actions: The Credit Assignment Problem

### Discounted rewards

> **Figure 18-6.** At the left, the light-blue cartoon robot (antenna, round eyes, wrench-shaped hands). From it a black horizontal timeline runs right in three segments, each ending in a black arrowhead. Above the first segment is a red heart; above the third segment is a fire (red outer flame, orange middle, yellow core).
> Below the timeline, three rows of labels, right-aligned row names on the left and one column under each segment:
> - "Actions:" — Right, Right, Right (black).
> - "Rewards:" — **+10** (green), **0** (black), **-50** (red).
> - A black down-arrow under each reward; the first two down-arrows have a small "+" beside them.
> - "Sum of discounted future rewards:" — **-22** (red), **-40** (red), **-50** (red).
> - Between the bottom-row numbers, two black arrows point **left**: from -50 to -40 and from -40 to -22. Each arrow has the label "80%" just below it.
> - At the bottom centre, the label "Discount ratio" with two black dashed arrows rising from it, one to each "80%".
>
> (So $-40 = 0 + 0.8 \times (-50)$ and $-22 = 10 + 0.8 \times (-40)$.)

*Caption:* Figure 18-6. Computing an action's return: the sum of discounted future rewards

---

## Slide 28 — Evaluating Actions: The Credit Assignment Problem

### Discounted rewards (cont.)

- If the discount rate $\gamma$ is close to $0$, then future rewards won't count for much compared to immediate rewards.
- Conversely, if the discount rate $\gamma$ is close to $1$, then rewards far into the future will count almost as much as immediate rewards.
- Typical discount rates are $0.95$ or $0.99$. With $\gamma = 0.95$, rewards $13$ steps into the future count roughly for half as much as immediate rewards (since $0.95^{13} \approx 0.5$), while with $\gamma = 0.99$, rewards $69$ steps into the future count for half as much as immediate rewards.
- In the CartPole environment, actions have fairly short-term effects, so choosing a discount rate of $0.95$ seems reasonable.

---

## Slide 29 — Evaluating Actions: The Credit Assignment Problem

### Action advantage

Of course, a good action may be followed by several bad actions that cause the pole to fall quickly, resulting in the good action getting a low score. However, if we play the game many times then, on average, good actions will get a better score than bad ones.

So, to get fairly reliable action scores, we must run many episodes and then normalize all the action scores (by subtracting the mean and dividing by the standard deviation). This calculation gives us a ***normalized score*** for the action taken at each time step, also referred to as the ***action advantage***.

After that, we can reasonably assume that actions with a negative advantage were bad while actions with a positive advantage were good.

---

## Slide 30 — Policy Gradients

- ***Policy gradients*** (**PG**) algorithms optimize the parameters of a policy by following the gradients toward higher rewards.
- One popular class of PG algorithms, called ***REINFORCE algorithms***, was introduced back in 1992<sup>1</sup> by Ronald Williams.
- A common variant of the REINFORCE algorithms is:
  1. Let the neural network policy play the game several times and at each step compute the gradients that would make the chosen action even more likely, but don't apply these gradients yet.
  2. Once you have run several episodes, compute each action's score (i.e., the ***action advantage*** described in the previous slide).

**Footnotes:**

1. "Simple Statistical Gradient-Following Algorithms for Connectionist Reinforcement Learning," R. Williams (1992).

("PG" is dark red, upright; its parentheses are black. The step numbers "1." and "2." are dark blue. Footnote 1 is black, below a short rule; the comma after the title is inside the closing quotation mark.)

---

## Slide 31 — Policy Gradients (cont.)

- A common variant of the REINFORCE algorithms is:
  3. If an action's score is positive, it means that the action was good and you want to apply the gradients computed earlier to make the action even more likely to be chosen in the future. However, if the score is negative, it means the action was bad and you want to apply the opposite gradients to make this action slightly less likely in the future. The solution is simply to multiply each gradient vector by the corresponding action's score.
  4. Finally, compute the mean of all the resulting gradient vectors, and use it to perform a gradient descent step.

(The numbering continues from slide 30; "3." and "4." are dark blue.)

---

## Slide 32 — Policy Gradients (cont.)

### Implementation using tf.keras

We will train the neural network in Figure 18-5 for the CartPole problem.

```python
def play_one_step(env, obs, model, loss_fn):
    with tf.GradientTape() as tape:
        left_proba = model(obs[np.newaxis])
        action = (tf.random.uniform([1, 1]) > left_proba)
        y_target = tf.constant([[1.]]) - tf.cast(action, tf.float32)
        loss = tf.reduce_mean(loss_fn(y_target, left_proba))
    grads = tape.gradient(loss, model.trainable_variables)
    obs, reward, done, truncated, info = env.step(int(action))
    return obs, reward, done, truncated, grads
```

Since we are acting as though the chosen action is the best possible action, the target probability must be $1.0$ if the chosen action is action $0$ (left) and $0.0$ if it is action $1$ (right). Thus, we have the line:

```python
y_target = tf.constant([[1.]]) - tf.cast(action, tf.float32)
```

("tf.keras" in the sub-heading is blue bold sans-serif, not typewriter.)

---

## Slide 33 — Policy Gradients (cont.)

### Implementation using tf.keras (cont.)

Play enough episodes and collect the rewards and gradients...

```python
def play_multiple_episodes(env, n_episodes, n_max_steps, model, loss_fn):
    all_rewards = []
    all_grads = []
    for episode in range(n_episodes):
        current_rewards = []
        current_grads = []
        obs, info = env.reset()
        for step in range(n_max_steps):
            obs, reward, done, truncated, grads = play_one_step(
                env, obs, model, loss_fn)
            current_rewards.append(reward)
            current_grads.append(grads)
            if done or truncated:
                break

        all_rewards.append(current_rewards)
        all_grads.append(current_grads)

    return all_rewards, all_grads
```

(The `def` line's final ":" runs past the right edge of the grey code box.)

---

## Slide 34 — Policy Gradients (cont.)

### Implementation using tf.keras (cont.)

Define functions for the rewards...

```python
def discount_rewards(rewards, discount_factor):
    discounted = np.array(rewards)
    for step in range(len(rewards) - 2, -1, -1):
        discounted[step] += discounted[step + 1] * discount_factor
    return discounted

def discount_and_normalize_rewards(all_rewards, discount_factor):
    all_discounted_rewards = [discount_rewards(rewards, discount_factor)
                              for rewards in all_rewards]
    flat_rewards = np.concatenate(all_discounted_rewards)
    reward_mean = flat_rewards.mean()
    reward_std = flat_rewards.std()
    return [(discounted_rewards - reward_mean) / reward_std
            for discounted_rewards in all_discounted_rewards]
```

We can check that the functions work using some fictitious `rewards` and `discount_rate` parameter values.

(The `all_discounted_rewards = [...` line reaches the right edge of the grey code box.)

---

## Slide 35 — Policy Gradients (cont.)

### Implementation using tf.keras (cont.)

We are almost ready to train our algorithm. Just need to define some hyperparameters:

```python
n_iterations = 150
n_episodes_per_update = 10
n_max_steps = 200
discount_factor = 0.95

optimizer = tf.keras.optimizers.Nadam(learning_rate=0.01)
loss_fn = tf.keras.losses.binary_crossentropy
```

---

## Slide 36 — Policy Gradients (cont.)

### Implementation using tf.keras (cont.)

Now define our training loop:

```python
for iteration in range(n_iterations):
    all_rewards, all_grads = play_multiple_episodes(
        env, n_episodes_per_update, n_max_steps, model, loss_fn)

    # extra code { displays some debug info during training
    total_rewards = sum(map(sum, all_rewards))
    print(f"\rIteration: {iteration + 1}/{n_iterations},"
        f" mean rewards: {total_rewards / n_episodes_per_update:.1f}", end="")

    all_final_rewards = discount_and_normalize_rewards(all_rewards,
                                                       discount_factor)
    all_mean_grads = []
    for var_index in range(len(model.trainable_variables)):
        mean_grads = tf.reduce_mean(
            [final_reward * all_grads[episode_index][step][var_index]
             for episode_index, final_rewards in enumerate(all_final_rewards)
                 for step, final_reward in enumerate(final_rewards)], axis=0)
        all_mean_grads.append(mean_grads)

    optimizer.apply_gradients(zip(all_mean_grads, model.trainable_variables))
```

The `print` statement shows:

```
Iteration: 150/150, mean rewards: 190.3
```

(This code box uses a smaller typewriter font than the other code boxes. The comment really shows a left brace "{" after "extra code", where an en dash ("–") is evidently meant. Column positions: `[final_reward` starts at column 12, `for episode_index` at column 13, `for step` at column 17, and `discount_factor)` at column 55, under `all_rewards`.)

---

## Slide 37 — Policy Gradients (cont.)

### Implementation using tf.keras (cont.)

This is a very impressive performance. The algorithm on average is able to balance the pole for $190.3$ time steps!!!

The last thing we want to do is to view the animation:

```python
np.random.seed(42)
show_one_episode(pg_policy)
```

where `show_one_episode` takes in the input policy and plays the CartPole game. At each step, an image is rendered. At the end of the game, the list of images generated is passed to the `matplotlib.anomation.FuncAnimation` function to show the animation.
(see the Jupyter-notebook file for Chapter 18 from the author Géron)

(See `cits5017-lect09-demo-CartPole3_using-NN-policy-gradients.webm` for the visualization generated by the `show_one_episode` function.)

(The last "(See …)" note is in a smaller font.)

---

---

## Slide 38 — Markov Decision Processes

Whereas PG algorithms try to directly optimize the policy to increase rewards, the algorithms we will look at now are less direct: the agent learns to estimate the expected sum of discounted future rewards
– for each state, or
– for each action in each state,
then uses this knowledge to decide how to act.

To understand these algorithms, we must first introduce ***Markov decision processes*** (**MDPs**).

(The two "–" lines are en-dash lines inside the paragraph, not bulleted list items. "Markov decision processes" is dark-red italic; "MDPs" is dark red, upright, and its parentheses are black.)

---

## Slide 39 — Markov Decision Processes

### Markov chains

In the early 20th century, the mathematician Andrey Markov studied stochastic processes with no memory, called **Markov chains**. Such a process has a fixed number of states, and it randomly evolves from one state $s$ to another $s'$ at each step with a fixed probability. This process depends only on the pair $(s, s')$, not on past states (the system has no memory).

> **Figure 18-7.** Four pale-green circles with black outlines (the states). $s_0$, $s_1$ and $s_2$ sit in a row from left to right, and $s_3$ sits below, between $s_0$ and $s_1$. (The labels are in a sans-serif font, and the "s" is about as tall as the digits.) The black arrows carry these transition probabilities:
> - $s_0 \to s_0$: a self-loop on the left of $s_0$, **0.7**
> - $s_0 \to s_1$: a straight arrow to the right, **0.2**
> - $s_0 \to s_3$: an arrow down and then right into $s_3$, **0.1**
> - $s_1 \to s_2$: the upper straight arrow to the right, **0.9**
> - $s_2 \to s_1$: the lower straight arrow, pointing left, **1.0**
> - $s_1 \to s_3$: an arrow down and then left into $s_3$, **0.1**
> - $s_3 \to s_3$: a self-loop below $s_3$, **1.0**
>
> $s_1$ has no self-loop. The "1.0" label of $s_3$'s self-loop sits right on top of the caption line, just above "Example".

*Caption:* Figure 18-7. Example of a Markov chain

("Markov chains" in the text is dark red and bold. $s$, $s'$ and $(s, s')$ are blue maths.)

---

## Slide 40 — Markov Decision Processes

### Markov chains

We can use a ***state transition matrix*** to describe a Markov chain. E.g., the state transition matrix for Figure 18-7 is:

$$
\begin{bmatrix}
0.7 & 0.2 & 0.0 & 0.1 \\
0.0 & 0.0 & 0.9 & 0.1 \\
0.0 & 1.0 & 0.0 & 0.0 \\
0.0 & 0.0 & 0.0 & 1.0
\end{bmatrix}
$$

> **Figure 18-7.** (Repeated from slide 39, drawn smaller, to the right of the matrix. The states, arrows and probabilities are the same: $s_0 \to s_0$ 0.7, $s_0 \to s_1$ 0.2, $s_0 \to s_3$ 0.1, $s_1 \to s_2$ 0.9, $s_2 \to s_1$ 1.0, $s_1 \to s_3$ 0.1, $s_3 \to s_3$ 1.0.)

*Caption:* Figure 18-7. Example of a Markov chain

where the row indices (representing the ***source states***) and column indices (representing the ***destination states***) are in the order of $s_0$, $s_1$, $s_2$, and $s_3$. E.g., (row 2, column 3) has probability = 0.9, denoting the state transition from state $s_1$ to $s_2$ has probability $0.9$. **In a state transition matrix, each row contains probabilities that sum to** $1$**.**

(The matrix is blue maths. The last sentence, "In a state transition matrix, each row contains probabilities that sum to 1.", is entirely dark red and upright, apart from the "1", which is blue maths. The first "probability = 0.9" is in the black text font; the second "0.9" is blue maths. Every matrix entry agrees with the figure.)

---

## Slide 41 — Markov Decision Processes

***Markov decision processes*** were first described in the 1950s by Richard Bellman.They resemble Markov chains but with a twist:

- At each step, an agent can choose one of several possible actions, and the transition probabilities depend on the chosen action.
- Moreover, some state transitions return some reward (positive or negative), and the agent's goal is to find a policy that will maximize rewards over time.

> **Figure 18-8.** Three pale-green state circles in a row: $s_0$ (left), $s_1$ (centre) and $s_2$ (right). Each action is a light-blue diamond with a black outline, labelled $a_0$, $a_1$ or $a_2$. A short black arrow runs from each state to each of its action diamonds. From each diamond, black or grey arrows run to the possible next states, each labelled with its transition probability. Rewards are written in colour beside an arrow.
> - **From $s_0$** (three actions):
>   - $a_1$ (diamond above $s_0$): a black arrow curves round the left back into $s_0$, labelled **1.0**.
>   - $a_0$ (diamond below $s_0$): a black arrow curves round the lower left back into $s_0$, labelled **0.7**, with a green "**+10**" above one red heart. A grey arrow runs right to $s_1$, labelled **0.3**.
>   - $a_2$ (diamond to the right of $s_0$): a grey arrow points back left into $s_0$, labelled **0.8**, and a black arrow runs right to $s_1$, labelled **0.2**.
> - **From $s_1$** (two actions; there is no $a_1$ diamond):
>   - $a_0$ (diamond below $s_1$): a grey arrow curves back up into $s_1$, labelled **1.0**.
>   - $a_2$ (diamond to the right of $s_1$): a black arrow runs to $s_2$, labelled **1.0**, with a red "**-50**" above a flame emoji (the "fire").
> - **From $s_2$** (one action):
>   - $a_1$ (diamond above $s_2$): a grey arrow runs along the whole top of the figure back to $s_0$, labelled **0.8**, with a green "**+40**" above four red hearts. A second grey arrow curves back to $s_1$, labelled **0.1**. A third grey arrow curves round the right back into $s_2$, labelled **0.1**.

*Caption:* Figure 18-8. Example of a Markov decision process. Symbols $a_0$, $a_1$, and $a_2$ denote the 3 possible actions.

("Markov decision processes" is dark-red italic. There is no space after the full stop in "Bellman.They". The bullets are small blue squares. In the caption, $a_0$, $a_1$ and $a_2$ are blue maths. The probabilities and rewards in the figure match the lists on slide 47.)

---

## Slide 42 — Markov Decision Processes

By looking at this MDP (Figure 18-8), can we guess which strategy will gain the most reward over time? In state $s_0$ it is clear that $a_0$ is the best option (to gain $+10$ reward), but in state $s_1$ it is not obvious whether the state should stay put (choose action $a_0$ to remain at $s_1$) or go through the fire (choose action $a_2$). For state $s_2$, the only available action is $a_1$, which will most likely lead the system back to state $s_1$ or back to $s_0$ with a large reward of $+40$.

Bellman proposed a **recursive** equation (known as the ***Bellman Optimality Equation***) which says that

> ***the optimal value of the current state is equal to the reward it will get on average after taking one optimal action, plus the expected optimal value of all possible future states that this action can lead to.***

("recursive" is dark red and upright. The parentheses around "Bellman Optimality Equation" are black. The quotation is an indented block, all in dark-red italic.)

---

## Slide 43 — Markov Decision Processes

### Bellman Optimality Equation

$$V^*(s) = \max_a \sum_{s'} T(s, a, s') \big[R(s, a, s') + \gamma V^*(s')\big] \quad \text{for all } s$$

- $V^*(s)$ is the ***optimal state value*** of the state $s$.
- $T(s, a, s')$ is the transition probability from state $s$ to $s'$ given that the agent chose action $a$.
- $R(s, a, s')$ is the reward that the agent gets when it goes from state $s$ to $s'$ given that the agent chose action $a$.
- $\gamma$ is the ***discount rate*** (a number in the range $0..1$).

The recursive formulation of the **Bellman Optimality Equation** can be implemented iteratively using the ***value iteration*** algorithm. A remarkable result is that, given enough iterations, we are guaranteed to converge to the optimal state values for all the states, corresponding to the optimal policy.

(The whole equation, including the sans-serif words "for all", is blue. No equation number is shown. "Bellman Optimality Equation" in the last paragraph is dark red and upright. "optimal state value", "discount rate" and "value iteration" are dark-red italic.)

---

## Slide 44 — Markov Decision Processes

### The value iteration algorithm

We can implement the ***Bellman Optimality Equation*** iteratively using the ***value iteration*** algorithm below:

$$V_{k+1}(s) \leftarrow \max_a \sum_{s'} T(s, a, s') \big[R(s, a, s') + \gamma V_k(s')\big] \quad \text{for all } s$$

where $V_k(s)$ is the estimated value of state $s$ at the $k^{\text{th}}$ iteration of the algorithm.

**Note:** This algorithm is an example of ***dynamic programming***, which breaks down a complex problem (in this case estimating a potentially infinite sum of discounted future rewards) into tractable subproblems that can be tackled iteratively (in this case finding the action that maximizes the average reward plus the discounted next state value).

("Note:" is black bold. "Bellman Optimality Equation", "value iteration" and "dynamic programming" are dark-red italic. The equation is blue and has no number. In "$k^{\text{th}}$" only the $k$ is blue; the superscript "th" is black.)

---

## Slide 45 — Markov Decision Processes

### Q-value iteration algorithm

Knowing the optimal state values is useful for evaluating a policy, but it does not tell the agent explicitly what the optimal action to take at each state. Luckily, Bellman found a very similar algorithm to estimate the optimal ***state-action values***, generally called the ***Q-Values***.

The optimal Q-Value of the state-action pair $(s, a)$, noted $Q^*(s, a)$, is:

> ***the sum of discounted future rewards the agent can expect on average after it reaches the state*** $s$ ***and chooses action*** $a$***, but before it sees the outcome of this action, assuming it acts optimally after that action.***

("state-action values" and "Q-Values" are dark-red italic. The quotation is an indented dark-red italic block; its $s$ and $a$ are blue maths.)

---

## Slide 46 — Markov Decision Processes

### Q-value iteration algorithm (cont.)

We can start by initializing all the Q-value estimates to zero, then you update them using the ***Q-value iteration algorithm*** below:

$$Q_{k+1}(s, a) \leftarrow \sum_{s'} T(s, a, s') \left[R(s, a, s') + \gamma \max_{a'} Q_k(s', a')\right] \quad \text{for all } (s,a)$$

Once you have the optimal Q-values, the ***optimal policy*** (often denoted as $\pi^*(s)$) is easy to define: when the agent is in state $s$, it should choose the action with the highest Q-value for that state:

$$\pi^*(s) = \operatorname*{argmax}_a Q^*(s, a).$$

("Q-value iteration algorithm" and "optimal policy" are dark-red italic. Both equations are blue and unnumbered. In the first equation the square brackets are tall, the subscript $k+1$ is set very tightly, and the closing "$(s,a)$" has no space after the comma, unlike $(s, a)$ elsewhere. "argmax" is one upright word with $a$ centred below it.)

---

## Slide 47 — Markov Decision Processes

### Q-value iteration algorithm (cont.)

Let's apply the Q-Value Iteration algorithm to the MDP in Figure 18-8. Firstly, we define the MDP:

```python
transition_probabilities = [ # shape=[s, a, s']
        [[0.7, 0.3, 0.0], [1.0, 0.0, 0.0], [0.8, 0.2, 0.0]],
        [[0.0, 1.0, 0.0], None, [0.0, 0.0, 1.0]],
        [None, [0.8, 0.1, 0.1], None]]
rewards = [ # shape=[s, a, s']
        [[+10, 0, 0], [0, 0, 0], [0, 0, 0]],
        [[0, 0, 0], [0, 0, 0], [0, 0, -50]],
        [[0, 0, 0], [+40, 0, 0], [0, 0, 0]]]
possible_actions = [[0, 1, 2], [0, 2], [1]]
```

> **Figure 18-8.** (Repeated from slide 41, drawn smaller and centred below the code. It is the same diagram: states $s_0$, $s_1$, $s_2$; action diamonds $a_0$, $a_1$, $a_2$; probabilities 1.0, 0.7, 0.3, 0.8, 0.2 from $s_0$; 1.0 and 1.0 from $s_1$; 0.8, 0.1, 0.1 from $s_2$; rewards green "+10" with one heart, red "-50" with the flame, green "+40" with four hearts.)

*Caption:* Figure 18-8. Example of a Markov decision process

(The code box is grey. The continuation lines are indented 8 spaces. This caption has no second sentence and no full stop, unlike slide 41's. Read against the figure, the lists say: `transition_probabilities[s][a]` gives the probabilities of going to $s_0$, $s_1$, $s_2$; `None` marks an action that isn't available in that state ($a_1$ in $s_1$; $a_0$ and $a_2$ in $s_2$); `rewards[0][0][0] = +10`, `rewards[1][2][2] = -50` and `rewards[2][1][0] = +40`.)

---

## Slide 48 — Markov Decision Processes

### Q-value iteration algorithm (cont.)

Now let's initialize all the Q-Values to $0$ (or to $-\infty$ for those impossible actions) and then run the Q-Value Iteration algorithm:

```python
Q_values = np.full((3, 3), -np.inf)  # -np.inf for impossible actions
for state, actions in enumerate(possible_actions):
    Q_values[state, actions] = 0.0  # for all possible actions

gamma = 0.90  # the discount factor

history1 = []  # extra code for generating a figure later on
for iteration in range(50):
    Q_prev = Q_values.copy()
    history1.append(Q_prev) # extra code
    for s in range(3):
        for a in possible_actions[s]:
            Q_values[s, a] = np.sum([
                    transition_probabilities[s][a][sp]
                    * (rewards[s][a][sp] + gamma * Q_prev[sp].max())
                for sp in range(3)])

history1 = np.array(history1)  # extra code
```

(The code box is grey. `history1.append(Q_prev) # extra code` has one space before "#"; every other comment has two.)

---

## Slide 49 — Markov Decision Processes

### Q-value iteration algorithm (cont.)

The resulting Q-Values look like this:

```python
>>> Q_values
array([[18.91891892, 17.02702703, 13.62162162],
       [ 0.        ,        -inf, -4.87971488],
       [       -inf, 50.13365013,        -inf]])
>>> np.argmax(Q_values, axis=1)   # optimal action for each state
array([0, 0, 1])
```

The results above say that if the agent was at state $s_0$, then action $a_0$ is the optimal action; if at state $s_1$ then take action $a_0$ (stay put); at state $s_2$ there is only one possible action ($a_1$).

If we change the discount factor $\gamma$ to $0.95$ and rerun the code then we get:

```python
...
>>> np.argmax(Q_values, axis=1)   # optimal action for each state
array([0, 2, 1])
```

The optimal action at state $s_1$ becomes $a_2$ (going into the fire!)

(Both code boxes are grey and use a smaller typewriter font than the earlier slides. Three spaces come before each "# optimal action for each state" comment. The final sentence has no full stop and runs into the slide number "49 / 69".)

---

## Slide 50 — Temporal Difference Learning

Reinforcement learning problems with discrete actions can be modelled as Markov decision processes, but the agent often does not know what the transition probabilities are (i.e., it does not know $T(s, a, s')$) or what the rewards are going to be (i.e., it does not know $R(s, a, s')$). The agent must experience each state and each transition at least once to know the rewards, and it must go through each state multiple times to get a reasonable estimate of the transition probabilities.

---

## Slide 51 — Temporal Difference Learning

The ***temporal difference*** (**TD**) learning algorithm is very similar to the ***Q-value iteration algorithm***, but tweaked to take into account the fact that the agent has only partial knowledge of the MDP. For example, the agent may use a random ***exploration policy*** to explore the MDP. The TD learning algorithm updates the estimates of the state values based on the transitions and rewards that are actually observed:

$$V_{k+1}(s) \leftarrow (1 - \alpha) V_k(s) + \alpha(r + \gamma\, V_k(s'))$$

or equivalently:

$$V_{k+1}(s) \leftarrow V_k(s) + \alpha\, \delta_k(s, r, s')$$
$$\text{with } \delta_k(s, r, s') = r + \gamma\, V_k(s') - V_k(s)$$

where $\alpha$ is the learning rate; $r + \gamma\, V_k(s')$ is called the ***TD target***; $\delta_k(s, r, s')$ is called the ***TD error***.

("temporal difference", "Q-value iteration algorithm", "exploration policy", "TD target" and "TD error" are dark-red italic. "TD" in parentheses is dark red and upright, with black parentheses. The second display is two centred lines; the word "with" is blue sans-serif. No equation numbers are shown.)

---

## Slide 52 — Temporal Difference Learning (cont.)

TD learning has many similarities with stochastic gradient descent, including the fact that it handles one sample at a time. Moreover, just like SGD, it can only truly converge if you gradually reduce the learning rate; otherwise, it will keep bouncing around the optimum Q-values.

For each state $s$, this algorithm keeps track of a running average of the immediate rewards the agent gets upon leaving that state, plus the rewards it expects to get later, assuming it acts optimally.

---

## Slide 53 — Q-Learning

The ***Q-learning algorithm*** is an adaptation of the ***Q-value iteration algorithm*** to the situation where the transition probabilities and the rewards are initially unknown. It works by watching an agent play and gradually improving its estimates of the Q-values. Once it has Q-value estimates close enough, the optimal policy is to choose the action that has the highest Q-value (i.e., the greedy policy):

$$Q_{k+1}(s, a) \leftarrow (1 - \alpha) Q_k(s, a) + \alpha \left(r + \gamma \max_{a'} Q_k(s', a')\right)$$

where $\alpha$ is the learning rate (e.g., $0.01$).

For each state-action pair $(s, a)$, this algorithm keeps track of a running average of the rewards $r$ the agent gets upon leaving the state $s$ with action $a$, plus the rewards it expects to get later.

Since the target policy would act optimally, we take the maximum of the Q-value estimates for the next state.

("Q-learning algorithm" and "Q-value iteration algorithm" are dark-red italic. The equation is blue, with tall parentheses, and has no number.)

---

## Slide 54 — Q-Learning

The Q-value at $(s_0, a_0)$ with the discount rate $\gamma = 0.9$:

> **Figure 18-9.** Two side-by-side matplotlib panels (serif font, light-grey grid). Each has one solid blue curve and a black dashed horizontal line slightly below the 20 gridline. The panels share the y-axis, and only the left one has tick labels.
> - *Left, titled "Q-Value Iteration":* x-axis "Iterations", 0 to 50, with ticks 0, 10, 20, 30, 40, 50. y-axis "Q-Value($s_0$, $a_0$)" ($s_0$, $a_0$ in italic), with ticks 0, 5, 10, 15, 20; the axis carries on a little above 20 with no further label. The smooth curve starts at 0 at iteration 0 and climbs steeply, bending over. By about iteration 10–15 it lies flat on the dashed line, and it stays flat until iteration 50.
> - *Right, titled "Q-Learning":* x-axis "Iterations", 0 to 10000, with ticks 0, 2000, 4000, 6000, 8000, 10000. The y tick marks have no labels. The curve is jagged. It shoots up from 0 within the first few hundred iterations, then climbs noisily and crosses the dashed line at about 2000 iterations. It overshoots to a peak a little above the 20 gridline at about 3500 iterations, then drifts back down, wavering just above the dashed line. From about 6500 iterations it wobbles closely around the dashed line until 10000.

*Caption:* Figure 18-9. Learning curve of the Q-value iteration algorithm versus the Q-learning algorithm

The Q-Value Iteration algorithm (left) converges very quickly, in fewer than $20$ iterations, while the Q-Learning algorithm (right) takes about $8,000$ iterations to converge. Obviously, not knowing the transition probabilities or the rewards makes finding the optimal policy significantly harder!

("20" and "8, 000" are blue maths. The eight thousand is typeset as maths **"8, 000"**, with a space after the comma. The slide doesn't say what the dashed line is.)

---

## Slide 55 — Q-Learning

Similarly, if we compare the Q-values at $(s_2, a_1)$ with the discount rate $\gamma = 0.9$ from the two algorithms, we see that the Q-Learning algorithm took much longer to converge to the ground truth value.

> **Figure (slide 55).** The same two-panel layout as Figure 18-9, for $(s_2, a_1)$. In each panel the black dashed horizontal line sits just above the 50 gridline.
> - *Left, titled "Q-Value Iteration":* x-axis "Iterations", 0 to 50 (ticks every 10). y-axis "Q-Value($s_2$, $a_1$)", with ticks 0, 10, 20, 30, 40, 50; the axis carries on a little above 50. The curve jumps from 0 to about 32 at the first iteration, reaches about 40 at the second, then bends over and lies flat on the dashed line from about iteration 10–12 to 50.
> - *Right, titled "Q-Learning":* x-axis "Iterations", 0 to 10000 (ticks every 2000). The shared y-axis has unlabelled ticks. The curve rises steeply and jaggedly to about 40 by roughly 1000 iterations, then climbs ever more slowly (about 45 near 2000 iterations, about 47–48 by 4000). It creeps towards the dashed line but is still just below it at 10000 iterations.

*Caption:* Learning curve of the Q-value iteration algorithm versus the Q-learning algorithm for $(s_2, a_1)$.

(This chart has no figure number. The $(s_2, a_1)$ in the caption is blue maths.)

---

## Slide 56 — Q-Learning

### Off-policy and on-policy

The Q-Learning algorithm that we have just implemented is called an ***off-policy*** algorithm because the policy being trained is not necessarily the one used during training.

Conversely, the Policy Gradients algorithm is an ***on-policy*** algorithm: it explores the world using the policy being trained.

It is somewhat surprising that Q-Learning is capable of learning the optimal policy by just watching an agent act randomly (imagine learning to play golf when your teacher is a drunk monkey).

For ***on-policy*** algorithms, we need good **exploration policies** since the space of the "world" is usually huge.

("off-policy" and both "on-policy" are dark-red italic. "exploration policies" is dark red and upright.)

---

## Slide 57 — Q-Learning

### The $\epsilon$-greedy policy

Q-Learning can work only if the ***exploration policy*** explores the MDP thoroughly. We can design a purely random exploration policy. This would guarantee that the algorithm will visit all the states many times. However, this may take a long time to do.

A better option is to use the $\epsilon$***-greedy policy***. The hyperparameter $\epsilon$ is often set to a large value close to $1$ initially and gradually reduced to a small value (e.g., $0.05$) over time.

Thus, initially the Q-Learning algorithm would explore randomly with a high probability $\epsilon$ (and only greedily choose the action with highest Q-value with probability $1 - \epsilon$). As time goes by, when $\epsilon$ is small, the algorithm would be more greedy in choosing the action which has the highest Q-values.

(The epsilon is the lunate glyph $\epsilon$ throughout, not $\varepsilon$; in the heading it is blue like the heading. In "$\epsilon$-greedy policy" the $\epsilon$ is blue maths and "-greedy policy" is dark-red italic. "exploration policy" is dark-red italic. The three paragraphs follow one another with no vertical gap.)

---

## Slide 58 — Approximate Q-Learning

The main problem with Q-Learning is that it does not scale well to large (or even medium) MDPs with many states and actions, as the number of parameters can be too large to be manageable.

The solution is to find a function $Q_\theta(s, a)$ that approximates the Q-Value of any state-action pair $(s, a)$ using a manageable number of parameters (given by the parameter vector $\theta$). This is called ***Approximate Q-Learning***.

(Here $\theta$ is a plain italic theta, not bold, both in $Q_\theta$ and on its own. "Approximate Q-Learning" is dark-red italic.)

---

## Slide 59 — Approximate Q-Learning

For years it was recommended to use linear combinations of **hand-crafted features** extracted from the state (e.g., for the **Ms. Pac-Man** game, the distance of the closest ghosts, their directions, and so on) to estimate Q-Values, but recent research (esp. from DeepMind) showed that using deep neural networks can work much better, and it does not require any feature engineering.

We can train a DNN to estimate the Q-values. Such a network is called a ***deep Q-network*** (**DQN**). Using a DQN for **Approximate Q-Learning** is called ***Deep Q-Learning***.

The main idea is to use a manageable number of parameters (represented by the vector $\boldsymbol{\theta}$).

("hand-crafted features", "Ms. Pac-Man", "DQN" and "Approximate Q-Learning" are dark red and upright. "deep Q-network" and "Deep Q-Learning" are dark-red italic. The parentheses around "DQN" are black. Here $\boldsymbol{\theta}$ is a **bold** italic blue theta.)

---

## Slide 60 — Approximate Q-Learning

Consider the case where a state-action pair $(s, a)$ is given, and we want the approximate Q-value to be **as close as possible** to the reward that we actually observe after playing the action $a$ in state $s$ plus the discounted future rewards. To estimate these future rewards, we can just execute the DQN on the <u>next</u> state $s'$, for all possible actions $a'$.

Once we have the future rewards estimated, we select the highest one and discount it by the factor $\gamma$. Adding it to the reward $r$ at the current state $s$ for taking action $a$ gives us the approximate Q-value.
The target Q-value (Eq. 18-7) is:

$$y(s, a) = r + \gamma \, \max_{a'} Q_{\boldsymbol{\theta}}(s', a').$$

With this target Q-value, we can run a training step using any gradient descent algorithm to minimize the squared error or the Huber loss between $Q_{\boldsymbol{\theta}}(\cdot, \cdot)$ and the target Q-value.

And that is the ***deep Q-learning algorithm***!

("as close as possible" is black bold. "next" is underlined. "deep Q-learning algorithm" is dark-red italic. The $\boldsymbol{\theta}$ subscripts are bold. "The target Q-value (Eq. 18-7) is:" starts a new line with no vertical gap. "(Eq. 18-7)" is the only equation number on slides 38–69.)

---

## Slide 61 — Deep Q-Learning

### Implementation using tf.keras

```python
input_shape = [4]  # == env.observation_space.shape
n_outputs = 2      # == env.action_space.n
model = tf.keras.Sequential([
    tf.keras.layers.Dense(32, activation="elu", input_shape=input_shape),
    tf.keras.layers.Dense(32, activation="elu"),
    tf.keras.layers.Dense(n_outputs)
])

def epsilon_greedy_policy(state, epsilon=0):
    if np.random.rand() < epsilon:
        return np.random.randint(n_outputs)  # random action
    else:
        Q_values = model.predict(state[np.newaxis], verbose=0)[0]
        return Q_values.argmax()  # optimal action according to the DQN

# We will also need a replay buffer. It will contain the agent's
# experiences, in the form of tuples: (obs, action, reward, next_obs,
# done). We can use the deque class for that.
from collections import deque
replay_buffer = deque(maxlen=2000)
```

(The code box is grey. The first `Dense` line runs past the right edge of the grey box; its closing "),", sits outside it.)

---

## Slide 62 — Deep Q-Learning

### Implementation using tf.keras (cont.)

```python
# Let's create a function to sample experiences from the replay buffer.
# It will return a list of 6 NumPy arrays: [obs, actions, rewards,
# next_obs, dones, truncateds].
def sample_experiences(batch_size):
    indices = np.random.randint(len(replay_buffer), size=batch_size)
    batch = [replay_buffer[index] for index in indices]
    return [
        np.array([experience[field_index] for experience in batch])
        for field_index in range(6)
    ]  # [states, actions, rewards, next_states, dones, truncateds]

# A function that will use the DQN to play one step, and record its
# experience in the replay buffer
def play_one_step(env, state, epsilon):
    action = epsilon_greedy_policy(state, epsilon)
    next_state, reward, done, truncated, info = env.step(action)
    replay_buffer.append((state, action, reward, next_state, done, truncated))
    return next_state, reward, done, truncated, info
```

(The code box is grey. The `replay_buffer.append(...)` line runs past the grey box to the right edge of the slide; its final ")" touches the edge.)

---

## Slide 63 — Deep Q-Learning

### Implementation using tf.keras (cont.)

```python
batch_size = 32
discount_factor = 0.95
optimizer = tf.keras.optimizers.Nadam(learning_rate=1e-2)
loss_fn = tf.keras.losses.mean_squared_error

def training_step(batch_size):
    experiences = sample_experiences(batch_size)
    states, actions, rewards, next_states, dones, truncateds = experiences
    next_Q_values = model.predict(next_states, verbose=0)
    max_next_Q_values = next_Q_values.max(axis=1)
    runs = 1.0 - (dones | truncateds)  # episode is not done or truncated
    target_Q_values = rewards + runs * discount_factor * max_next_Q_values
    target_Q_values = target_Q_values.reshape(-1, 1)
    mask = tf.one_hot(actions, n_outputs)
    with tf.GradientTape() as tape:
        all_Q_values = model(states)
        Q_values = tf.reduce_sum(all_Q_values * mask, axis=1, keepdims=True)
        loss = tf.reduce_mean(loss_fn(target_Q_values, Q_values))

    grads = tape.gradient(loss, model.trainable_variables)
    optimizer.apply_gradients(zip(grads, model.trainable_variables))
```

(The code box is grey. Three lines run past the right edge of the box: "... = experiences", "... * max_next_Q_values" and "... keepdims=True)".)

---

## Slide 64 — Deep Q-Learning

### Implementation using tf.keras (cont.)

```python
# Now, let's train the model!
rewards = []
best_score = 0
for episode in range(600):
    obs, info = env.reset()
    for step in range(200):
        epsilon = max(1 - episode / 500, 0.01)
        obs, reward, done, truncated, info = play_one_step(env, obs, epsilon)
        if done or truncated:
            break
    # extra code - displays debug info
    print(f"\rEpisode: {episode + 1}, Steps: {step + 1}, eps: {epsilon:.3f}",
          end="")
    rewards.append(step)
    if step >= best_score:
        best_weights = model.get_weights()
        best_score = step
    if episode > 50:
        training_step(batch_size)

model.set_weights(best_weights)  # extra code { restores the best model weight
```

(The code box is grey. The `play_one_step(...)` line, the `print(...)` line and the last line run past the right edge of the grey box. The last line is cut off at the right edge of the slide after "weight". The PDF's text layer goes on with an "s" ("weights") that falls outside the page. The "{" after "extra code" is printed as shown; see the quirks. "# extra code - displays debug info" uses a plain hyphen.)

---

## Slide 65 — Deep Q-Learning

### Visualise the rewards that we saved

```python
Episode: 600, Steps: 100, eps: 0.010  # my output from the code
                                      # on the previous slide
plt.figure(figsize=(8, 4))
plt.plot(rewards)
plt.xlabel("Episode", fontsize=14)
plt.ylabel("Sum of rewards", fontsize=14)
plt.grid(True)
plt.show()
```

> **Figure (slide 65).** A wide matplotlib line chart (serif font, light-grey grid) with one blue line. x-axis "Episode", with ticks 0, 100, 200, 300, 400, 500, 600. y-axis "Sum of rewards", with ticks 0, 25, 50, 75, 100, 125, 150, 175, 200. Shape:
> - *Episodes 0 to about 180:* low and noisy, mostly between about 10 and 40. There are isolated spikes to about 65–70 and one spike to about 106 (near episode 107).
> - *About 180–260:* rising and more erratic, mostly between about 15 and 80, with spikes to about 112 and about 125 (near episode 200).
> - *About 265:* the line first touches the 200 ceiling.
> - *About 265–390:* violent swings between 200 and dips as low as about 12–30. Around episodes 355–370 the line stays flat at 200.
> - *About 390–420:* the line falls from near 200 to roughly 120–170.
> - *About 420–600:* the line fluctuates between roughly 95 and 160, with three single-episode plunges to about 30, 25 and 23 (near episodes 429, 450 and 483). The last stretch hovers around 100–125, and the line ends at about 125 at the right edge.

(Note that the result from my run was much worse than that from the textbook.)

(The code box is grey. Its first two lines are printed output plus a comment, not code. The chart has no figure number or title. The closing note in parentheses is in a smaller font, centred under the chart.)

---

## Slide 66 — Deep Q-Learning

### Visualise the rewards that we saved (cont.)

As you can see, the algorithm took a while to start learning anything, in part because $\epsilon$ was very high at the beginning. It first reached the max reward at around episode $290$, but it immediately dropped, then bounced up and down a few times, and soon after it looked like it had finally stabilized near the max reward, at around episode $550$, its score again dropped down dramatically. At the last episode, the reward was only $100$. This is called ***catastrophic forgetting***, and it is one of the big problems facing virtually all RL algorithms.

(See `cits5017-lect09-demo-CartPole4_using-DQN-epsilon-greedy-policy.webm` for the visualization generated by the `show_one_episode` function where the pole tilted over at step $143$, which is still not too bad.)

("catastrophic forgetting" is dark-red italic. $\epsilon$, 290, 550, 100 and 143 are blue maths. The last paragraph, in parentheses, is in a smaller font. Its file name and function name are dark-red typewriter.)

---

## Slide 67 — Deep Q-Learning

### Conclusion

Reinforcement learning is notoriously difficult, largely because of the training instabilities and the huge sensitivity to the choice of hyperparameter values and random seeds. Many state-of-the-art RL algorithms were trained with millions of steps for long periods of time and the learning rate was set to drop extremely slowly.

(The ending sentence of the chapter from Géron...)
Reinforcement learning is a huge and exciting field, with new ideas and algorithms popping out every day, so I hope this chapter sparked your curiosity: there is a whole world to explore!

(The quoted sentence starts on the line directly after "(The ending sentence of the chapter from Géron...)", with no gap.)

---

## Slide 68 — Summary

- Understand when to apply *reinforcement learning* (know its applications)
- Understand the concept of *rewards* in RL
- Understand *policy search* and *policy gradients* in RL
- Know how to use the OpenAI Gym toolkit to train a NN for a simple game, such as *CartPole*
- Understand the concept of action evaluation (The Credit Assignment Problem) and discounted rewards
- Understand Markov Decision Processes (MDP)
- Understand Q-learning, $\epsilon$ greedy policy, approximate Q-learning, and deep Q-learning
- Know how to implement a deep Q-learning network for a simple problem.

(The italic words are black italic, not dark red. The $\epsilon$ is blue maths, and there is no hyphen between it and "greedy". Only the last bullet ends with a full stop.)

---

## Slide 69 — That is all...

This is the last topic of the unit. I hope you enjoyed all the topics as much as I did.

Good luck for the exam!

Have a good week.

---

## Quirks

### Slides 1–37

- **Slide 2:** "Chapters 18." uses a plural and a full stop for a single chapter. The slide text writes "Hands-on" (lowercase "on"), while the cover reads "Hands-On".
- **Slide 3:** "$\epsilon$ greedy policy" has no hyphen (usually "ε-greedy"). "Rewards" is the only italic item in the list.
- **Slides 7–10 (Figure 18-1):** The caption on all four slides lists five panels (a)–(e), but slides 7–8 show only (a)–(b) and slides 9–10 only (c)–(e); slides 7 and 8 (and slides 9 and 10) repeat the same image. The text's item letters don't match the panels. Slide 9's "(c)" describes the thermostat, which is panel (d). Slide 10's "(d)" describes the stock-market trader, which is panel (e). Slide 10's "(e)" (maze robot) has no panel. The Go player (panel c) is never described.
- **Slide 9:** "it can be a smart thermostat, getting rewards whenever it is close to the target temperature and saves energy" mixes verb forms ("getting … and saves"). "moving thing. e.g., it can be …" starts a sentence with lowercase "e.g." (also slide 16: "to live in. e.g., an Atari …").
- **Slide 14:** "An offspring is just a copy of its parent." Géron's text says an offspring is a copy of its parent "plus some random variation". As written, the offspring add no variation, so the search could never improve on the survivors.
- **Slide 15:** "which we will see more detail later" is missing "in".
- **Slide 16:** The toolkit is called "OpenAI gym" (lowercase "g", in the key term) and "OpenAI Gym", but the package installed and imported (slides 16–17) is `gymnasium`. The slides never say that this is a different package (a successor to OpenAI Gym).
- **Slide 17:** `gym.make("CartPole-v1", reader_mode="rgb_array")` — `reader_mode` is almost certainly a typo for `render_mode`, which `env.render()` on slide 18 needs (Géron's code uses `render_mode="rgb_array"`). The text calls the cart "the robot" ("where the robot can move left or right"). "(4) its angular velocity (positive means clockwise." never closes its parenthesis. The `array(...)` output line overflows the code box (also on slide 20).
- **Slide 18:** "can be render" should be "rendered". `env.reset()` is called again, with no seed and its result discarded. But slide 20's `env.step` output continues from slide 17's seed-42 state, not from this new reset: $0.0273956 + 0.02 \times (-0.00611216) = 0.02727336$ and $0.03585979 + 0.02 \times 0.0197368 = 0.03625453$. `plt` is used, but `import matplotlib.pyplot as plt` is never shown. The rendered image has no figure number.
- **Slide 19:** "accelerating the robot left" / "accelerating the robot right" — it is the cart (slide 20 says "accelerate the cart"). "returns the possible action" is singular. The comma in "left and," is misplaced.
- **Titles:** Slides 17–19 are all titled "Introduction to OpenAI Gym", and only slide 20 adds "(cont.)". Slides 23–25 ("Neural Network Policies") and 26–29 ("Evaluating Actions: The Credit Assignment Problem") repeat their titles with no "(cont.)".
- **Slide 21:** "accelerate left …" vs "accelerates right …" use different verb forms. The two policy lines use en dashes instead of bullets.
- **Slide 22:** `totals.append(episode_rewards)` is correctly inside the episode loop (4-space indent, after a blank line). `np` is used, but `import numpy as np` doesn't appear on slides 1–37 (also slides 32 and 34). The printed tuple `(41.698, 8.389445512070509, 24.0, 63.0)` agrees with the text (mean 41.698, max 63).
- **Slide 23:** "We can train a neural network to create a policy to move the e.g., a network as shown in Figure 18-5:" is garbled: a noun (probably "cart") is missing after "the", and there is a stray "e.g.,". "This exploration/exploitation dilemma" has nothing to refer back to, since the slide never explains exploring vs exploiting. The bullets are round blue dots, unlike the rest of the deck's squares. Figure 18-5 draws **4** hidden neurons, but slide 25's code uses `Dense(5, ...)`.
- **Slide 25:** The first `Dense` layer is given `input_shape=[n_inputs]` instead of a separate `Input(shape=...)` layer. "includes also" has awkward word order. "Jupyter-Notebook" here vs "Jupyter-notebook" on slide 37.
- **Slide 26:** "the reward for the next 3 steps are" — the singular "reward" doesn't agree with "are". The arithmetic checks out: $10 + 0.8 \times 0 + 0.64 \times (-50) = -22$. Slides 26 and 27 together are the worked example; Figure 18-6 is on slide 27, not 26.
- **Slides 26–36, naming of $\gamma$:** The text calls it the "discount rate", Figure 18-6 labels the 80% factor "Discount ratio", and the code calls it `discount_factor`. Figure 18-6's numbers check out: $-40 = 0 + 0.8(-50)$, $-22 = 10 + 0.8(-40)$.
- **Slide 28:** Both claims check out: $0.95^{13} \approx 0.513$ and $0.99^{69} \approx 0.500$. The wording differs: "count roughly for half as much" for 0.95, but "count for half as much" for 0.99.
- **Slide 30:** Footnote 1 gives only the title, author and year, with no venue (journal) and no page numbers. The REINFORCE steps are split: 1–2 here, 3–4 on slide 31, which repeats the lead-in "A common variant of the REINFORCE algorithms is:".
- **Slide 33:** The `def play_multiple_episodes(...)` line overflows the code box.
- **Slide 34:** The text says "`rewards` and `discount_rate` parameter values", but the function's parameter is `discount_factor`. The slide says "We can check that the functions work" but shows no check.
- **Slide 36:** The comment reads "# extra code { displays some debug info during training". The "{" is a typesetting artefact where Géron's notebook has an en dash ("# extra code – displays …"). This code box uses a smaller font than the others. The printed "mean rewards: 190.3" is the mean over the 10 episodes of the **final** iteration only.
- **Slide 37:** "`matplotlib.anomation.FuncAnimation`" is a typo for `matplotlib.animation.FuncAnimation`. `pg_policy` and `show_one_episode` are never defined on slides 1–37. "The algorithm on average is able to balance the pole for 190.3 time steps!!!" overstates what was measured: 190.3 is the last iteration's 10-episode mean, and episodes are capped at `n_max_steps = 200`. "(see the Jupyter-notebook …)" begins with a lowercase "see".
- **Demo videos:** Slides 22, 25 and 37 refer to `cits5017-lect09-demo-CartPole1_using-basic-hard-coded-policy.webm`, `cits5017-lect09-demo-CartPole2_using-NN-random-policy.webm` and `cits5017-lect09-demo-CartPole3_using-NN-policy-gradients.webm`. These files are not part of the PDF.
- **Spelling:** The deck mixes British "centre" (slide 17) with American "behavior", "optimize", "normalize", "visualization".

### Slides 38–69

- **Slide 40:** The example counts matrix rows and columns from 1 ("(row 2, column 3) has probability = 0.9"), but it counts states from 0 ("from state $s_1$ to $s_2$"). So row 2 is $s_1$ and column 3 is $s_2$. The matrix entries match Figure 18-7, and every row sums to 1. The first "= 0.9" is in the text font; the second "0.9" is blue maths.
- **Slide 41:** "Richard Bellman.They resemble …" has no space after the full stop.
- **Figure 18-8 (slides 41, 47):** The labels "s0", "s1", "s2" are drawn about as tall as the digits, taller than the "a" in the action labels. The caption on slide 41 ends with "Symbols $a_0$, $a_1$, and $a_2$ denote the 3 possible actions."; slide 47's caption stops at "process", with no full stop. Every probability and reward in the figure matches the `transition_probabilities` and `rewards` lists on slide 47.
- **Slide 42:** "whether the state should stay put" — it is the agent that stays put, not the state. "[$a_1$] will most likely lead the system back to state $s_1$ or back to $s_0$ with a large reward of $+40$": in Figure 18-8 and on slide 47, $a_1$ from $s_2$ goes to $s_0$ with probability 0.8 (+40), to $s_1$ with only 0.1, and back to $s_2$ with 0.1. The most likely outcome is $s_0$, and the return to $s_2$ isn't mentioned. "(to gain +10 reward)" leaves out that $a_0$ in $s_0$ pays +10 only on the 0.7 self-loop.
- **Equation numbering (slides 43–60):** The Bellman, value-iteration, Q-value-iteration, TD and Q-learning equations have no numbers. Only slide 60 cites a number, "(Eq. 18-7)", which refers to the textbook's numbering.
- **Slide 45:** "it does not tell the agent explicitly what the optimal action to take at each state" is missing "is". Capitalisation varies across slides 45–59: "Q-value"/"Q-Value"/"Q-Values", "Q-value iteration"/"Q-Value Iteration", "Q-Learning"/"Q-learning".
- **Slide 46:** "We can start by initializing … then you update them" switches from "we" to "you". The trailing "$(s,a)$" is set without a space after the comma.
- **Slide 47:** The typewriter font draws the apostrophes in `# shape=[s, a, s']` as curly ’. They are written straight here, as in the lecture-8 transcript.
- **Slide 48:** `history1.append(Q_prev) # extra code` has one space before "#"; the other comments have two. The "figure later on" made from `history1` isn't shown, though Figure 18-9's left panel (50 iterations) matches `range(50)`.
- **Slide 49:** A re-run of slides 47–48 reproduces the printed values and `array([0, 0, 1])`. A current NumPy prints 17.02702702 rather than ...703, a last-digit float difference. With γ = 0.95 it reproduces `array([0, 2, 1])`. The comment has three spaces before "#". The last sentence has no full stop.
- **Slide 51:** It says TD learning is "very similar to the Q-value iteration algorithm", but the update it shows is for **state values** $V_k(s)$. That is the counterpart of value iteration (slide 44), not Q-value iteration.
- **Slide 52:** "it will keep bouncing around the optimum **Q-values**" — the TD algorithm on slide 51 estimates state values $V$, not Q-values. "assuming it acts optimally" doesn't appear in the TD update, which has no max over actions.
- **Slide 53:** "the optimal policy is to choose the action that has the highest Q-value (i.e., the greedy policy):" ends with a colon, but what follows is the Q-learning **update rule**, not a policy. "target policy" is used without being defined.
- **Slide 54:** "about $8,000$ iterations" is typeset as maths "8, 000", with a space after the comma. Neither chart says what the black dashed line is (presumably the converged Q-value-iteration value).
- **Slide 55:** The chart has no figure number. In the right panel the Q-learning curve is still just below the dashed "ground truth" line at 10,000 iterations, so it has not fully converged within the plotted range.
- **Slides 56–57 (exploration):** Slide 56 calls Q-learning **off-policy**, then says "For ***on-policy*** algorithms, we need good exploration policies since the space of the 'world' is usually huge." Slide 57 opens with "Q-Learning can work only if the exploration policy explores the MDP thoroughly". So the need for a good exploration policy is tied to on-policy algorithms on one slide and to an off-policy one (Q-learning) on the next. Slide 56 also says "The Q-Learning algorithm that we have just implemented", but slides 38–69 show no Q-learning code, only Q-value-iteration code (slide 48) and Q-learning curves (slides 54–55).
- **Slide 57 vs slide 64:** ε is said to start "close to 1" and fall to "a small value (e.g., 0.05)". The code `epsilon = max(1 - episode / 500, 0.01)` starts at exactly 1 and falls to 0.01, reached at episode 495. "the action which has the highest Q-values" uses a plural.
- **Slides 58–60:** θ is plain italic $\theta$ on slide 58 and bold $\boldsymbol{\theta}$ on slides 59–60. "Approximate Q-Learning" is dark-red italic on slide 58 but dark-red upright on slide 59.
- **Slide 60:** "Adding it to the reward $r$ … gives us the approximate Q-value": that sum is the **target** Q-value $y(s, a)$, as the next line says, not the approximate $Q_{\boldsymbol\theta}(s,a)$. The slide mentions "the squared error or the Huber loss", and the code (slide 63) uses `tf.keras.losses.mean_squared_error`.
- **Slides 61–62 (replay buffer):** The comment on slide 61 says the buffer holds 5-field tuples "(obs, action, reward, next_obs, done)". But `play_one_step` (slide 62) appends 6 fields, adding `truncated`, and `sample_experiences` returns 6 arrays (`range(6)`). Slide 62's two comments name the arrays differently: "[obs, actions, rewards, next_obs, dones, truncateds]" versus "# [states, actions, rewards, next_states, dones, truncateds]". `np`, `tf` and `env` are used but never set up in slides 38–69.
- **Slide 62:** This `play_one_step(env, state, epsilon)` reuses the name of the policy-gradient function `play_one_step(env, obs, model, loss_fn)` from earlier in the deck, with a different signature.
- **Slides 61–64 (layout):** Several code lines run past the grey box (slide 61 first `Dense`; slide 62 `replay_buffer.append`; slide 63 three lines; slide 64 three lines). Slide 64's last line is cut off at the slide edge: "…restores the best model weight". The PDF text has "weights", but the "s" lies outside the page.
- **Slide 64:** In "# extra code { restores the best model weight", the "{" stands where the textbook has an en dash (–). It looks like a font-encoding artefact: in the old TeX typewriter encoding the en-dash slot prints as "{". The earlier comment "# extra code - displays debug info" uses a plain hyphen. `rewards = []` reuses the name of the MDP `rewards` list from slide 47. `rewards.append(step)` stores the step index (episode length − 1), not a sum of rewards.
- **Slides 65–66 (the lecturer's run):** The printed output "Episode: 600, Steps: 100" means the last stored value is `step` = 99, and slide 66 says "At the last episode, the reward was only 100". The plotted line, however, ends at about 125, on the 125 gridline. The y-axis is labelled "Sum of rewards", but the code plots `step`. Slide 66's story doesn't match slide 65's chart. The text says the agent "first reached the max reward at around episode 290", but the chart first hits 200 at about episode 265. The text puts a dramatic drop "at around episode 550" after it "stabilized near the max reward", but the chart has no such drop near 550. The big fall is around episodes 390–420, with single-episode plunges near 429, 450 and 483, and after about 390 the line never returns to the 200 ceiling. These sentences may describe the textbook's run, which slide 65 says was much better.
- **Slide 66:** "Visualise" (British, in the heading) and "visualization" (American, in the note) are both used. The demo video and the step-143 claim can't be checked from the slides.
- **Slide 68:** "$\epsilon$ greedy policy" has no hyphen (slide 57: "$\epsilon$-greedy"). "(MDP)" is singular, while slide 38 has "(MDPs)". "(The Credit Assignment Problem)" capitalises "The". Only the last bullet ends with a full stop.
