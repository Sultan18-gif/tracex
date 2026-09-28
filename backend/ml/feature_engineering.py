def build_features(transactions):
    """
    Convert blockchain transactions into ML features.
    """

    if not transactions:
        return [
            0,  # transaction count
            0,  # total value
            0,  # unique receivers
            0,  # average transaction value
            0,  # zero value transactions
            0,  # rapid transactions
            0,  # mixer interactions
            0,  # bridge interactions
            0,  # intermediary hops
        ]

    transaction_count = len(transactions)

    total_value = 0

    receivers = set()

    values = []

    zero_value_transactions = 0

    mixer_interactions = 0
    bridge_interactions = 0

    for tx in transactions:

        receiver = (
            tx.get("receiver")
            or tx.get("to")
            or ""
        ).lower()

        amount = (
            tx.get("amount")
            or tx.get("value")
            or tx.get("valueEth")
            or tx.get("ethValue")
            or 0
        )

        try:
            amount = float(amount)
        except (TypeError, ValueError):
            amount = 0

        values.append(amount)
        total_value += amount

        if receiver:
            receivers.add(receiver)

        if amount == 0:
            zero_value_transactions += 1

        # Simple demo pattern indicators
        if (
            "tornado" in receiver
            or "mixer" in receiver
        ):
            mixer_interactions += 1

        if (
            "bridge" in receiver
            or "stargate" in receiver
        ):
            bridge_interactions += 1

    average_value = (
        total_value / transaction_count
        if transaction_count
        else 0
    )

    # Basic rapid-transaction indicator.
    # Later we can calculate this properly from timestamps.
    rapid_transactions = 0

    if transaction_count >= 20:
        rapid_transactions = transaction_count // 5

    # Approximate intermediary activity.
    intermediary_hops = max(
        0,
        len(receivers) - 1
    )

    return [
        transaction_count,
        total_value,
        len(receivers),
        average_value,
        zero_value_transactions,
        rapid_transactions,
        mixer_interactions,
        bridge_interactions,
        intermediary_hops,
    ]
