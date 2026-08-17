# Seed Facts - Computer Science

20 general-knowledge facts from MnemosyneC's own hand-authored starter set ("starter_chocolate", not MMLU-Pro, not scraped from any third-party source). These exist so a fresh install has something real to recall on the very first question instead of an empty substrate. Ask about any topic below and MnemosyneC should answer from local memory.

## Facts

**Q: What is Big-O notation?**
A: Big-O notation describes the upper bound on the growth rate of an algorithm's time or space complexity as input size n grows. O(1) is constant, O(log n) is logarithmic, O(n) is linear, O(n²) is quadratic.

**Q: What is the difference between a stack and a queue?**
A: A stack is LIFO (Last In First Out) - items are pushed and popped from the top. A queue is FIFO (First In First Out) - items are enqueued at the back and dequeued from the front.

**Q: What is a binary search tree?**
A: A binary search tree (BST) is a tree data structure where each node's left subtree contains only smaller values and right subtree only larger values, enabling O(log n) search, insert, and delete in balanced cases.

**Q: What is dynamic programming?**
A: Dynamic programming solves complex problems by breaking them into overlapping subproblems, solving each once, and storing results (memoization/tabulation). It converts exponential algorithms to polynomial ones.

**Q: What is TCP/IP?**
A: TCP/IP is the fundamental internet protocol suite. TCP (Transmission Control Protocol) provides reliable ordered delivery. IP (Internet Protocol) handles addressing and routing packets across networks.

**Q: What is a hash table?**
A: A hash table stores key-value pairs using a hash function to map keys to array indices. It offers O(1) average-case lookup, insert, and delete. Collisions are handled by chaining or open addressing.

**Q: What is the halting problem?**
A: The halting problem asks whether an arbitrary program will finish running or loop forever on given input. Turing proved this is undecidable - no general algorithm can solve it for all possible programs.

**Q: What is object-oriented programming?**
A: OOP organizes software around objects that combine data (attributes) and behavior (methods). Key principles: encapsulation (hiding internals), inheritance (reusing parent class features), polymorphism (multiple forms).

**Q: What is a neural network?**
A: A neural network is a computational model inspired by biological neurons, consisting of layers of interconnected nodes. Deep learning uses many layers (deep networks) trained via backpropagation to recognize patterns.

**Q: What is a database transaction and ACID properties?**
A: A database transaction is a unit of work that must be Atomic (all or nothing), Consistent (valid state before/after), Isolated (transactions don't interfere), and Durable (committed changes persist).

**Q: What is recursion?**
A: Recursion is when a function calls itself with a simpler version of the problem until a base case is reached. Examples: factorial, Fibonacci, tree traversal. Every recursive function needs a base case to terminate.

**Q: What is the CAP theorem in distributed systems?**
A: The CAP theorem states that a distributed system cannot simultaneously guarantee all three of: Consistency (all nodes see the same data), Availability (every request gets a response), and Partition tolerance.

**Q: What is asymptotic analysis?**
A: Asymptotic analysis studies algorithm performance as input size grows to infinity. Big-O (upper bound), Omega (lower bound), and Theta (tight bound) characterize growth rates independent of hardware.

**Q: What is the difference between process and thread?**
A: A process is an independent program execution with its own memory space. Threads share a process's memory and resources, making communication easier but requiring synchronization to prevent race conditions.

**Q: What is public-key cryptography?**
A: Public-key (asymmetric) cryptography uses key pairs: a public key (shared openly) for encryption and a private key (kept secret) for decryption. RSA and elliptic-curve cryptography are common algorithms.

**Q: What is the difference between breadth-first and depth-first search?**
A: BFS explores all neighbors at the current depth before moving deeper, using a queue. DFS explores as far as possible along each branch before backtracking, using a stack. BFS finds shortest paths in unweighted graphs.

**Q: What is machine learning?**
A: Machine learning is a subset of AI where systems learn from data to make predictions or decisions without explicit programming. Supervised learning uses labeled examples; unsupervised learning finds patterns in unlabeled data.

**Q: What is an operating system?**
A: An operating system manages hardware resources (CPU, memory, storage, I/O) and provides a platform for applications. Core functions: process scheduling, memory management, file system, and device drivers.

**Q: What is version control?**
A: Version control tracks changes to files over time, enabling collaboration, rollback, and history. Git is the dominant system, using commits, branches, and merges to manage code evolution.

**Q: What is the P vs NP problem?**
A: P is the class of problems solvable in polynomial time. NP is the class of problems whose solutions can be verified in polynomial time. The unsolved P=NP question asks whether every verifiable problem is also efficiently solvable.
